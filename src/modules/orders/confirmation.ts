export type ConfirmationOrder = {
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
};

export type ConfirmationView = {
  heading: string;
  message: string;
  showRetry: boolean;
  /** Order itself was cancelled (nothing left to pay or wait for). */
  cancelled: boolean;
  /** Customer aborted at the Safepay step — order still awaiting payment. */
  abortedAtPayment: boolean;
  /** A previous retry attempt failed to start checkout (?payment_error=1). */
  paymentError: boolean;
};

/**
 * Pure state → view mapping for the order confirmation page. The page used
 * to hard-code "Order Confirmed" for every order; this gives each real state
 * its own heading/message and decides whether the "Pay now" retry button is
 * offered. Kept dependency-free so it is unit-testable.
 */
export function getConfirmationView(
  order: ConfirmationOrder,
  params: { cancelled?: boolean; paymentError?: boolean } = {}
): ConfirmationView {
  const base = {
    abortedAtPayment: params.cancelled === true && order.orderStatus !== "CANCELLED",
    paymentError: params.paymentError === true,
  };

  if (order.orderStatus === "CANCELLED") {
    return {
      heading: "Order Cancelled",
      message: "This order was cancelled — no payment or further action is needed.",
      showRetry: false,
      cancelled: true,
      ...base,
      abortedAtPayment: false,
    };
  }

  if (order.paymentStatus === "REFUNDED") {
    return {
      heading: "Payment Refunded",
      message: "The payment for this order has been refunded to you.",
      showRetry: false,
      cancelled: false,
      ...base,
    };
  }

  if (order.paymentStatus === "PAID") {
    return {
      heading: "Order Confirmed",
      message: "Thank you for your order — your payment was received. Your handmade Girah pieces are on their way.",
      showRetry: false,
      cancelled: false,
      ...base,
      abortedAtPayment: false,
    };
  }

  // Unpaid orders.
  if (order.paymentMethod !== "SAFEPAY") {
    return {
      heading: "Order Confirmed",
      message: "Thank you for your order — please pay with cash when it arrives.",
      showRetry: false,
      cancelled: false,
      ...base,
      abortedAtPayment: false,
    };
  }

  if (order.paymentStatus === "FAILED") {
    return {
      heading: "Payment Failed",
      message: "Your payment didn't go through and no money was taken. Your order is reserved — try paying again below.",
      showRetry: true,
      cancelled: false,
      ...base,
    };
  }

  return {
    heading: "Payment Pending",
    message: "Your order is reserved. Complete the payment below to confirm it.",
    showRetry: true,
    cancelled: false,
    ...base,
  };
}
