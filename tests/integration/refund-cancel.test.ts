import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { placeOrderCore } from "@/modules/checkout/place-order";
import { updateOrderStatusCore } from "@/modules/orders/status-ops";
import { refundSafepayPayment } from "@/modules/payments/safepay";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 3: cancelling a PAID order must return the money first.
// Safepay orders call the refund API; COD orders record cash returned
// offline. Either way the order lands REFUNDED and stock is credited back.

vi.mock("@/modules/payments/safepay", () => ({
  refundSafepayPayment: vi.fn(),
  createSafepayCheckoutUrl: vi.fn(),
  SafepayRefundError: class SafepayRefundError extends Error {},
}));

const safepayCheckout: CheckoutInput = {
  fullName: "Refund Tester",
  phone: "03001112223",
  email: "refund@girah.test",
  address: "Street 5",
  city: "Islamabad",
  postalCode: "",
  deliveryNotes: "",
  paymentMethod: "SAFEPAY",
};

const codCheckout: CheckoutInput = { ...safepayCheckout, paymentMethod: "COD" };

async function placeTestOrder(checkout: CheckoutInput, quantity: number) {
  const { variation } = await createTestProduct(); // stock 5
  const guestId = `guest-${Math.random().toString(36).slice(2)}`;
  const cart = await db.cart.create({ data: { guestId } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity } });
  const result = await placeOrderCore(checkout, { guestId });
  if (!result.success) throw new Error(`seed order failed: ${result.error}`);
  const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
  return { order, variation };
}

describe("refund on cancel", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(refundSafepayPayment).mockReset().mockResolvedValue(undefined);
  });

  it("COD PAID cancel: records REFUNDED, restocks, attributes the audit row, never calls Safepay", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(codCheckout, 2); // stock 5 -> 3
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);
    expect(refundSafepayPayment).not.toHaveBeenCalled();

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
    expect(fresh.paymentStatus).toBe("REFUNDED");

    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
    const rows = await db.stockAdjustment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.reason.includes("payment refunded"))).toBe(true);
  });

  it("SAFEPAY PAID cancel: refunds the recorded tracker for the full total, then REFUNDED + restock", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(safepayCheckout, 2);
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", safepayTracker: "track_paid_session" },
    });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);

    expect(refundSafepayPayment).toHaveBeenCalledTimes(1);
    expect(refundSafepayPayment).toHaveBeenCalledWith("track_paid_session", order.total);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
    expect(fresh.paymentStatus).toBe("REFUNDED");
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
  });

  it("refuses to cancel when Safepay rejects the refund — order and stock untouched", async () => {
    vi.mocked(refundSafepayPayment).mockRejectedValueOnce(new Error("refund rejected"));
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(safepayCheckout, 2);
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", safepayTracker: "track_paid_session" },
    });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/NOT cancelled/i);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CONFIRMED");
    expect(fresh.paymentStatus).toBe("PAID");
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(3);
    expect(await db.stockAdjustment.count()).toBe(0);
  });

  it("refuses to cancel a PAID Safepay order that has no recorded tracker (dashboard-refund path)", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(safepayCheckout, 1);
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Safepay dashboard/i);
    expect(refundSafepayPayment).not.toHaveBeenCalled();

    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus).toBe("CONFIRMED");
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(4);
  });

  it("unpaid SAFEPAY cancel: no refund call, straight restock", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(safepayCheckout, 2);

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);
    expect(refundSafepayPayment).not.toHaveBeenCalled();

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
    expect(fresh.paymentStatus).toBe("PENDING");
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
  });

  it("already-REFUNDED order (dashboard refund) cancels without a second refund and restocks", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const { order, variation } = await placeTestOrder(safepayCheckout, 1);
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED", safepayTracker: "track_refunded" },
    });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);
    expect(refundSafepayPayment).not.toHaveBeenCalled();

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.paymentStatus).toBe("REFUNDED");
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
  });
});
