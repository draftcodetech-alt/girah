"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createSafepayCheckoutUrl } from "@/modules/payments";
import { addToCart } from "@/modules/cart";
import { updateOrderStatusCore, canCustomerCancel } from "./status-ops";
import type { OrderActionResult } from "./types";

export type RetryPaymentResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

/**
 * Start (or restart) the Safepay checkout for an existing unpaid order.
 *
 * Creates a FRESH payment session; the previous one (if any) is abandoned.
 * `createSafepayCheckoutUrl` persists the new tracker with a CAS that can
 * never overwrite it after PAID, so the order always points at the session
 * that actually captured money.
 *
 * Extracted from the redirecting wrapper so it can be integration-tested
 * (persistence + URL construction) without Next redirect semantics.
 */
export async function retrySafepayPayment(orderId: string): Promise<RetryPaymentResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { success: false, error: "Order not found." };
  // Phase 4 M1: minting a fresh payment session re-points safepayTracker on
  // the order, so access follows the same owner-or-bearer rule as the
  // confirmation page: account orders require the owning session; guest
  // orders are guarded by their unguessable cuid. Unauthorized callers get
  // the IDENTICAL error as a missing id, so the response can't be used to
  // probe which order ids exist.
  if (order.userId) {
    const session = await auth();
    if (!session?.user || session.user.id !== order.userId) {
      return { success: false, error: "Order not found." };
    }
  }
  if (order.paymentMethod !== "SAFEPAY") {
    return { success: false, error: "This order doesn't use online payment." };
  }
  if (order.paymentStatus === "PAID") {
    return { success: false, error: "This order is already paid." };
  }
  if (order.paymentStatus === "REFUNDED") {
    return { success: false, error: "This order was refunded." };
  }
  if (order.orderStatus === "CANCELLED") {
    return { success: false, error: "This order was cancelled." };
  }

  const confirmationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}/confirmation`;
  try {
    const checkoutUrl = await createSafepayCheckoutUrl({
      orderId: order.id,
      amountInPaisa: order.total,
      redirectUrl: confirmationUrl,
      cancelUrl: `${confirmationUrl}?cancelled=1`,
    });
    return { success: true, checkoutUrl };
  } catch (error) {
    console.error(`Safepay retry checkout failed for order ${order.orderNumber}:`, error);
    return { success: false, error: "We couldn't start the payment. Please try again." };
  }
}

/**
 * Form action behind the confirmation page's "Pay now" button: navigates the
 * browser to Safepay on success, or back to the page with an error flag.
 */
export async function startSafepayRetry(orderId: string): Promise<void> {
  const result = await retrySafepayPayment(orderId);
  if (!result.success) {
    redirect(`/order/${orderId}/confirmation?payment_error=1`);
  }
  redirect(result.checkoutUrl);
}

/**
 * Customer self-service cancel (Phase 12). Scope is deliberately narrower
 * than the admin machine: UNPAID orders only (`canCustomerCancel`), so no
 * refund path can ever be reached from here — paid or in-flight orders go
 * through support/admin. The heavy lifting (CAS + restock + audit row with
 * `adminId: null`) is the shared `updateOrderStatusCore`.
 *
 * Ownership uses the same anti-enumeration rule as `retrySafepayPayment`:
 * a stranger's order id gets the IDENTICAL error as a missing one.
 */
export async function cancelMyOrder(orderId: string): Promise<OrderActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "You must be signed in." };

  const order = await db.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    select: { orderStatus: true, paymentStatus: true },
  });
  if (!order) return { success: false, error: "Order not found." };

  if (!canCustomerCancel(order)) {
    if (order.orderStatus === "CANCELLED") {
      return { success: false, error: "This order has already been cancelled." };
    }
    if (order.orderStatus === "DELIVERED") {
      return { success: false, error: "This order has already been delivered." };
    }
    if (order.paymentStatus !== "PENDING") {
      return {
        success: false,
        error: "This order has already been paid — contact us if you need to cancel it.",
      };
    }
    return {
      success: false,
      error: "This order is already being prepared and can't be cancelled online. Contact us for help.",
    };
  }

  const result = await updateOrderStatusCore(orderId, { orderStatus: "CANCELLED" }, null);
  if (result.success) {
    revalidatePath("/account/orders");
    revalidatePath(`/account/orders/${orderId}`);
    // Stock came back — cart lines and availability badges must refresh.
    revalidatePath("/", "layout");
  }
  return result;
}

export type ReorderResult =
  | { success: true; added: number; skipped: string[] }
  | { success: false; error: string; skipped: string[] };

/**
 * "Buy again": re-adds every line of one of the customer's orders to their
 * cart via the existing `addToCart` (so qty validation, live stock checks,
 * disabled-line refusal, quantity merging/capping and revalidation all come
 * from the one implementation). Unavailable lines are reported, never
 * silently dropped.
 */
export async function reorderOrder(orderId: string): Promise<ReorderResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in.", skipped: [] };
  }

  const order = await db.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    include: { items: { orderBy: { id: "asc" } } },
  });
  // Same anti-enumeration rule as cancelMyOrder / getMyOrderById.
  if (!order) return { success: false, error: "Order not found.", skipped: [] };
  if (order.items.length === 0) {
    return { success: false, error: "This order has no items to reorder.", skipped: [] };
  }

  let added = 0;
  const skipped: string[] = [];
  for (const item of order.items) {
    const result = await addToCart(item.variationId, item.quantity);
    if (result.success) added += 1;
    else skipped.push(`${item.productName} — ${item.variationName}`);
  }

  if (added === 0) {
    return {
      success: false,
      error: "None of this order's items are available right now.",
      skipped,
    };
  }
  return { success: true, added, skipped };
}
