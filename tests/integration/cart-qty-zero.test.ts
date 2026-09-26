import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { updateCartItemQuantityCore } from "@/modules/cart/ops";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 5 qty-0: with stock at 0 the old code computed
// Math.min(quantity, 0) = 0 and the DB CHECK (quantity >= 1) rejected the
// write, surfacing a generic failure. The core must refuse with an
// actionable message and leave the row untouched instead.
// Phase 5 disabled-line: getCartFor surfaces variation.isEnabled so the
// cart page can badge disabled lines BEFORE checkout.

async function seedCartLine(quantity: number, stock: number) {
  const { variation } = await createTestProduct();
  await db.productVariation.update({ where: { id: variation.id }, data: { stock } });
  const cart = await db.cart.create({ data: { guestId: `guest-qty-${Date.now()}-${Math.random()}` } });
  const item = await db.cartItem.create({
    data: { cartId: cart.id, variationId: variation.id, quantity },
  });
  return { cart, item, variation };
}

describe("updateCartItemQuantityCore — qty-0 guard", () => {
  beforeEach(resetDb);

  it("refuses a quantity change when stock has dropped to 0 (no CHECK crash)", async () => {
    const { item, cart } = await seedCartLine(3, 0);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 2, identity);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/out of stock/i);
    // Row untouched — still the original quantity, never 0.
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(3);
  });

  it("still deletes when quantity 0 is requested (remove path), even with stock 0", async () => {
    const { item, cart } = await seedCartLine(2, 0);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 0, identity);

    expect(result.success).toBe(true);
    expect(await db.cartItem.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it("decrements normally when stock is available", async () => {
    const { item, cart } = await seedCartLine(3, 2);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 2, identity);

    expect(result.success).toBe(true);
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(2); // capped to stock 2
  });

  it("caps to stock but never below 1 when stock > 0", async () => {
    const { item, cart } = await seedCartLine(5, 1);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 4, identity);

    expect(result.success).toBe(true);
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(1);
  });

  it("rejects non-integer / out-of-range quantities before touching the DB", async () => {
    const { item, cart } = await seedCartLine(2, 5);
    const identity = { guestId: cart.guestId! };

    for (const bad of [1.5, -1, 1000, Number.NaN]) {
      const result = await updateCartItemQuantityCore(item.id, bad, identity);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/invalid quantity/i);
    }
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(2);
  });

  it("returns the same refusal for a missing item and someone else's item (no oracle)", async () => {
    const { item, cart } = await seedCartLine(2, 5);

    const missing = await updateCartItemQuantityCore("nonexistent-id", 1, {
      guestId: cart.guestId!,
    });
    const foreign = await updateCartItemQuantityCore(item.id, 1, { guestId: "someone-else" });

    expect(missing.success).toBe(false);
    expect(foreign.success).toBe(false);
    if (!missing.success && !foreign.success) {
      expect(missing.error).toBe(foreign.error);
      expect(missing.error).toMatch(/not found in your cart/i);
    }
  });
});
