import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { placeOrderCore } from "@/modules/checkout/place-order";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 2: stock race. Two customers chasing the last units must never
// oversell — the conditional decrement decides the winner atomically.

const checkoutData: CheckoutInput = {
  fullName: "Stock Racer",
  phone: "03007654321",
  email: "stockrace@girah.test",
  address: "Street 2",
  city: "Karachi",
  postalCode: "",
  deliveryNotes: "",
  paymentMethod: "COD",
};

async function seedCart(variationId: string, quantity: number) {
  const guestId = `guest-${Math.random().toString(36).slice(2)}`;
  const cart = await db.cart.create({ data: { guestId } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId, quantity } });
  return { guestId };
}

describe("checkout stock race", () => {
  beforeEach(resetDb);

  it("two carts racing for limited stock: exactly one order, no oversell", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const a = await seedCart(variation.id, 3);
    const b = await seedCart(variation.id, 3);

    const results = await Promise.all([
      placeOrderCore(checkoutData, a),
      placeOrderCore(checkoutData, b),
    ]);

    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(1);

    const failure = results.find((r) => !r.success);
    if (failure && !failure.success) {
      expect(failure.error).toMatch(/no longer available/i);
    }

    expect(await db.order.count()).toBe(1);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(2); // 5 − 3, decremented exactly once
  });

  it("a cart exceeding available stock is rejected and leaves stock untouched", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const cart = await seedCart(variation.id, 6);

    const result = await placeOrderCore(checkoutData, cart);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no longer available/i);

    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(5);
    expect(await db.order.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(1); // cart preserved for the customer
  });
});
