import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { placeOrderCore } from "@/modules/checkout/place-order";
import { updateOrderStatusCore } from "@/modules/orders/status-ops";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 2: order-status state machine + restock-on-cancel with audit trail.

const checkoutData: CheckoutInput = {
  fullName: "Cancel Tester",
  phone: "03001112223",
  email: "cancel@girah.test",
  address: "Street 3",
  city: "Islamabad",
  postalCode: "",
  deliveryNotes: "",
  paymentMethod: "COD",
};

async function placeTestOrder(items: { variationId: string; quantity: number }[]) {
  const guestId = `guest-${Math.random().toString(36).slice(2)}`;
  const cart = await db.cart.create({ data: { guestId } });
  for (const item of items) {
    await db.cartItem.create({ data: { cartId: cart.id, ...item } });
  }
  const result = await placeOrderCore(checkoutData, { guestId });
  if (!result.success) throw new Error(`seed order failed: ${result.error}`);
  const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
  return order;
}

describe("updateOrderStatusCore state machine + restock", () => {
  beforeEach(resetDb);

  it("cancelling an unpaid order restocks every item and records attributed audit rows", async () => {
    const v1 = await createTestProduct(); // stock 5
    const v2 = await createTestProduct(); // stock 5
    const admin = await createTestUser({ role: "ADMIN" });

    const order = await placeTestOrder([
      { variationId: v1.variation.id, quantity: 2 },
      { variationId: v2.variation.id, quantity: 1 },
    ]);
    expect(order.orderStatus).toBe("CONFIRMED");

    expect((await db.productVariation.findUniqueOrThrow({ where: { id: v1.variation.id } })).stock).toBe(3);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: v2.variation.id } })).stock).toBe(4);

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);

    expect((await db.productVariation.findUniqueOrThrow({ where: { id: v1.variation.id } })).stock).toBe(5);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: v2.variation.id } })).stock).toBe(5);

    const rows = await db.stockAdjustment.findMany({ orderBy: { variationId: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.adminId === admin.id)).toBe(true);
    expect(rows.every((r) => r.reason.includes(order.orderNumber))).toBe(true);
    expect(rows.find((r) => r.variationId === v1.variation.id)).toMatchObject({
      previousStock: 3,
      adjustment: 2,
      newStock: 5,
    });
    expect(rows.find((r) => r.variationId === v2.variation.id)).toMatchObject({
      previousStock: 4,
      adjustment: 1,
      newStock: 5,
    });

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
  });

  it("cancelling a PAID COD order records REFUNDED (cash returned offline) and restocks", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });
    const order = await placeTestOrder([{ variationId: variation.id, quantity: 2 }]);

    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(result.success).toBe(true);

    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(5); // restocked: 3 + 2
    expect(await db.stockAdjustment.count()).toBe(1);
    const orderFresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderFresh.orderStatus).toBe("CANCELLED");
    expect(orderFresh.paymentStatus).toBe("REFUNDED");
  });

  it("rejects jumps backwards or over steps", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });
    const order = await placeTestOrder([{ variationId: variation.id, quantity: 1 }]);

    const backwards = await updateOrderStatusCore(order.id, { orderStatus: "PENDING" }, admin.id);
    expect(backwards.success).toBe(false);
    if (!backwards.success) expect(backwards.error).toMatch(/^Cannot move an order from/);

    const skipAhead = await updateOrderStatusCore(order.id, { orderStatus: "DELIVERED" }, admin.id);
    expect(skipAhead.success).toBe(false);
  });

  it("treats DELIVERED and CANCELLED as terminal", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });
    const order = await placeTestOrder([{ variationId: variation.id, quantity: 1 }]);

    await db.order.update({ where: { id: order.id }, data: { orderStatus: "DELIVERED" } });
    const afterDelivered = await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, admin.id);
    expect(afterDelivered.success).toBe(false);

    await db.order.update({ where: { id: order.id }, data: { orderStatus: "CANCELLED" } });
    const resurrect = await updateOrderStatusCore(order.id, { orderStatus: "CONFIRMED" }, admin.id);
    expect(resurrect.success).toBe(false);
  });

  it("same-status update is an idempotent no-op (no double restock)", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });
    const order = await placeTestOrder([{ variationId: variation.id, quantity: 2 }]);

    const result = await updateOrderStatusCore(order.id, { orderStatus: "CONFIRMED" }, admin.id);
    expect(result.success).toBe(true);
    expect(await db.stockAdjustment.count()).toBe(0);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(3);
  });

  it("advances a valid transition without restocking", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });
    const order = await placeTestOrder([{ variationId: variation.id, quantity: 1 }]);

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"] as const) {
      const result = await updateOrderStatusCore(order.id, { orderStatus: status }, admin.id);
      expect(result.success).toBe(true);
    }
    expect(await db.stockAdjustment.count()).toBe(0);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(4);
  });

  it("rejects invalid input and missing orders", async () => {
    const admin = await createTestUser({ role: "ADMIN" });

    const badInput = await updateOrderStatusCore("some-id", { orderStatus: "NONSENSE" }, admin.id);
    expect(badInput.success).toBe(false);
    if (!badInput.success) expect(badInput.error).toBe("Invalid status.");

    const missing = await updateOrderStatusCore(
      "no-such-order",
      { orderStatus: "CANCELLED" },
      admin.id
    );
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error).toBe("Order not found.");
  });
});
