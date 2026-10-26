import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import { refundSafepayPayment } from "@/modules/payments";
import { sendEmailSafe } from "@/lib/email";
import { orderStatusEmail, type CustomerStatusUpdate } from "@/lib/email-templates";
import type { OrderActionResult } from "./types";
import { orderStatusSchema } from "./schema";

// Phase 14: which transitions the customer hears about (§2 "key
// transitions" — CONFIRMED/PROCESSING stay quiet to avoid inbox noise).
const EMAILED_STATUSES = new Set<OrderStatus>(["SHIPPED", "DELIVERED", "CANCELLED"]);

// Allowed order-status transitions (Phase 2). Linear forward path with
// cancellation allowed up to (and including) SHIPPED; DELIVERED and
// CANCELLED are terminal. Anything else is a bogus jump — e.g. skipping
// PROCESSING or resurrecting a cancelled order.
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export class ConcurrentOrderUpdateError extends Error {
  constructor() {
    super("Order was modified concurrently.");
    this.name = "ConcurrentOrderUpdateError";
  }
}

/**
 * Core of the order-status state machine, shared by the admin wrapper
 * (`updateOrderStatus`) and other server callers.
 * Extracted from the "use server" wrapper so the state
 * machine + refund behaviour can be integration-tested without
 * Next request context. Auth is the caller's job. Cancelling a PAID order
 * issues the refund BEFORE mutating state. (The third argument this used to
 * take — the acting admin's id — only existed to attribute stock adjustments,
 * and went away with the stock concept.)
 */
export async function updateOrderStatusCore(
  orderId: string,
  input: unknown
): Promise<OrderActionResult> {
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid status." };
  }
  const next = parsed.data.orderStatus;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  // Same status — idempotent no-op. A double-clicked select must neither
  // fail nor apply twice.
  if (order.orderStatus === next) {
    return { success: true };
  }

  if (!ALLOWED_TRANSITIONS[order.orderStatus].includes(next)) {
    return { success: false, error: `Cannot move an order from ${order.orderStatus} to ${next}.` };
  }

  const wasPaid = order.paymentStatus === "PAID";
  let refundIssued = false;

  // Cancelling a PAID order must return the money BEFORE any state changes:
  //  - Safepay: call the refund API; if it fails the cancellation is refused
  //    and the order is left untouched (never cancel without refunding).
  //  - COD: staff return cash offline, so cancellation itself records the
  //    money as returned (paymentStatus -> REFUNDED below).
  // Unpaid orders (PENDING/FAILED/REFUNDED) need no refund call.
  if (next === "CANCELLED" && wasPaid && order.paymentMethod === "SAFEPAY") {
    if (!order.safepayTracker) {
      return {
        success: false,
        error:
          "This paid order has no Safepay payment reference recorded. Refund it from the Safepay dashboard first — once it shows REFUNDED, cancel it here.",
      };
    }
    try {
      await refundSafepayPayment(order.safepayTracker, order.total);
      refundIssued = true;
    } catch (error) {
      console.error(`Safepay refund refused for order ${order.orderNumber}:`, error);
      return {
        success: false,
        error:
          "Safepay rejected the refund — the order was NOT cancelled and nothing changed. Resolve the payment issue and try again.",
      };
    }
  }

  try {
    await db.$transaction(
      async (tx) => {
        // Compare-and-swap on BOTH status and paymentStatus: if another
        // admin or the payment webhook changed the order since we read it,
        // abort instead of committing on stale assumptions.
        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
          },
          data: {
            orderStatus: next,
            // A cancelled PAID order now holds no captured money: Safepay
            // refund succeeded above (or COD cash returned offline).
            ...(next === "CANCELLED" && wasPaid ? { paymentStatus: "REFUNDED" as const } : {}),
          },
        });
        if (claimed.count === 0) {
          throw new ConcurrentOrderUpdateError();
        }
        // No restock: the stock concept was removed (spec change) —
        // cancellation only moves status + payment.
      },
      { maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (refundIssued) {
      // The refund is already on its way out — state may now disagree with
      // the money. Loud log for reconciliation, whatever the failure was.
      console.error(
        `CRITICAL: refund issued for order ${order.orderNumber} (tracker ${order.safepayTracker}) but the cancellation could not be committed:`,
        error
      );
      return {
        success: false,
        error:
          "The refund was issued but the order could not be updated — verify the refund in the Safepay dashboard, then contact support.",
      };
    }
    if (error instanceof ConcurrentOrderUpdateError) {
      return { success: false, error: "This order was changed by someone else. Refresh and try again." };
    }
    console.error("updateOrderStatusCore failed:", error);
    return { success: false, error: "Failed to update the order. Please try again." };
  }

  // Phase 14: status email at the single choke point — every path (admin
  // select, customer cancel) lands here, after the txn committed. Best-effort
  // (never throws), so the state machine can never be failed by email.
  if (EMAILED_STATUSES.has(next)) {
    const wasRefunded = next === "CANCELLED" && wasPaid;
    await sendEmailSafe(
      orderStatusEmail(
        {
          to: order.customerEmail,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod: order.paymentMethod,
          orderStatus: next,
          paymentStatus: wasRefunded ? "REFUNDED" : order.paymentStatus,
          createdAt: order.createdAt,
          link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/account/orders/${order.id}`,
        },
        next as CustomerStatusUpdate
      )
    );
  }

  return { success: true };
}
