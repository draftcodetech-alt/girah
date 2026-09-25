import { describe, it, expect } from "vitest";
import { getConfirmationView, type ConfirmationOrder } from "@/modules/orders/confirmation";

const order = (overrides: Partial<ConfirmationOrder> = {}): ConfirmationOrder => ({
  paymentMethod: "SAFEPAY",
  paymentStatus: "PENDING",
  orderStatus: "PENDING",
  ...overrides,
});

describe("getConfirmationView", () => {
  it("shows Order Confirmed for a paid Safepay order", () => {
    const view = getConfirmationView(order({ paymentStatus: "PAID" }));
    expect(view.heading).toBe("Order Confirmed");
    expect(view.showRetry).toBe(false);
  });

  it("shows cash-on-delivery instructions for an unpaid COD order", () => {
    const view = getConfirmationView(
      order({ paymentMethod: "COD", paymentStatus: "PENDING", orderStatus: "CONFIRMED" })
    );
    expect(view.heading).toBe("Order Confirmed");
    expect(view.message).toMatch(/cash/i);
    expect(view.showRetry).toBe(false);
  });

  it("offers retry for a pending Safepay payment", () => {
    const view = getConfirmationView(order({ paymentStatus: "PENDING" }));
    expect(view.heading).toBe("Payment Pending");
    expect(view.showRetry).toBe(true);
  });

  it("offers retry for a failed Safepay payment", () => {
    const view = getConfirmationView(order({ paymentStatus: "FAILED" }));
    expect(view.heading).toBe("Payment Failed");
    expect(view.showRetry).toBe(true);
  });

  it("shows Payment Refunded without retry", () => {
    const view = getConfirmationView(order({ paymentStatus: "REFUNDED" }));
    expect(view.heading).toBe("Payment Refunded");
    expect(view.showRetry).toBe(false);
  });

  it("shows Order Cancelled without retry even when payment is pending", () => {
    const view = getConfirmationView(
      order({ paymentStatus: "PENDING", orderStatus: "CANCELLED" }),
      { cancelled: true }
    );
    expect(view.heading).toBe("Order Cancelled");
    expect(view.showRetry).toBe(false);
    expect(view.abortedAtPayment).toBe(false);
  });

  it("flags an abort at the payment step only while the order still stands", () => {
    const aborted = getConfirmationView(order({ paymentStatus: "PENDING" }), { cancelled: true });
    expect(aborted.abortedAtPayment).toBe(true);

    const alreadyCancelled = getConfirmationView(
      order({ orderStatus: "CANCELLED" }),
      { cancelled: true }
    );
    expect(alreadyCancelled.abortedAtPayment).toBe(false);

    const noParam = getConfirmationView(order({ paymentStatus: "PENDING" }));
    expect(noParam.abortedAtPayment).toBe(false);
  });

  it("carries the payment_error flag through every state", () => {
    const view = getConfirmationView(order(), { paymentError: true });
    expect(view.paymentError).toBe(true);
    expect(getConfirmationView(order()).paymentError).toBe(false);
  });

  it("clears the aborted note once the payment lands", () => {
    const view = getConfirmationView(order({ paymentStatus: "PAID" }), { cancelled: true });
    expect(view.abortedAtPayment).toBe(false);
    expect(view.heading).toBe("Order Confirmed");
  });
});
