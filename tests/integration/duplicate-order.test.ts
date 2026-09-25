import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { placeOrderCore } from "@/modules/checkout/place-order";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 2: duplicate-order race. A double-submitted checkout must produce
// exactly one order and exactly one stock decrement.

const checkoutData: CheckoutInput = {
  fullName: "Race Tester",
  phone: "03001234567",
  email: "race@girah.test",
  address: "Street 1, Test Block",
  city: "Lahore",
  postalCode: "54000",
  deliveryNotes: "",
  paymentMethod: "COD",
};

async function seedCart(quantity: number) {
  const { variation } = await createTestProduct();
  const guestId = `guest-${Math.random().toString(36).slice(2)}`;
  const cart = await db.cart.create({ data: { guestId } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity } });
  return { cart, variation, identity: { guestId } };
}

describe("placeOrderCore duplicate-checkout race", () => {
  beforeEach(resetDb);

  it("three concurrent checkouts of the same cart create exactly one order", async () => {
    const { variation, identity } = await seedCart(2);

    const results = await Promise.all([
      placeOrderCore(checkoutData, identity),
      placeOrderCore(checkoutData, identity),
      placeOrderCore(checkoutData, identity),
    ]);

    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(1);
    const failure = results.find((r) => !r.success);
    if (failure && !failure.success) {
      expect(failure.error).toMatch(/already completed|no longer available|couldn't place/i);
    }

    expect(await db.order.count()).toBe(1);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(3); // 5 − 2, decremented exactly once
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.orderItem.count()).toBe(1);
  });

  it("a sequential second checkout after success reports the cart empty", async () => {
    const { identity } = await seedCart(2);

    const first = await placeOrderCore(checkoutData, identity);
    expect(first.success).toBe(true);

    const second = await placeOrderCore(checkoutData, identity);
    expect(second.success).toBe(false);
    if (!second.success) expect(second.error).toBe("Your cart is empty.");

    expect(await db.order.count()).toBe(1);
  });

  it("checkout on a missing cart reports empty without creating anything", async () => {
    const result = await placeOrderCore(checkoutData, { guestId: "no-such-guest" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Your cart is empty.");
    expect(await db.order.count()).toBe(0);
  });
});
