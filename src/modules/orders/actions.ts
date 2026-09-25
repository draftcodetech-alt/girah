"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSafepayCheckoutUrl } from "@/modules/payments";

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
