import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { updateCartItemQuantityCore, MAX_QUANTITY } from "@/modules/cart/ops";
import { resetDb, createTestProduct } from "../setup/helpers";

// Quantity guards for a cart line. The stock-based refusal (qty-capped-to-0
// hitting the DB CHECK) was removed together with the stock concept — the
// remaining rules are: 0 means remove, out-of-range values are refused
// BEFORE the DB, and only the caller's own cart lines ever resolve.
// (Phase 5 disabled-line UX lives in cart-disabled-line.test.ts.)

async function seedCartLine(quantity: number) {
  const { variation } = await createTestProduct();
  const cart = await db.cart.create({
    data: { guestId: `guest-qty-${Date.now()}-${Math.random()}` },
  });
  const item = await db.cartItem.create({
    data: { cartId: cart.id, variationId: variation.id, quantity },
  });
  return { cart, item, variation };
}

describe("updateCartItemQuantityCore — quantity guard", () => {
  beforeEach(resetDb);

  it("quantity 0 removes the line", async () => {
    const { item, cart } = await seedCartLine(2);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 0, identity);

    expect(result.success).toBe(true);
    expect(await db.cartItem.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it("stores a valid quantity as-is (no stock ceiling anymore)", async () => {
    const { item, cart } = await seedCartLine(3);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, 2, identity);

    expect(result.success).toBe(true);
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(2);
  });

  it("accepts the crafted-payload ceiling (MAX_QUANTITY) itself", async () => {
    const { item, cart } = await seedCartLine(2);
    const identity = { guestId: cart.guestId! };

    const result = await updateCartItemQuantityCore(item.id, MAX_QUANTITY, identity);

    expect(result.success).toBe(true);
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(MAX_QUANTITY);
  });

  it("rejects non-integer / out-of-range quantities before touching the DB", async () => {
    const { item, cart } = await seedCartLine(2);
    const identity = { guestId: cart.guestId! };

    for (const bad of [1.5, -1, MAX_QUANTITY + 1, Number.NaN]) {
      const result = await updateCartItemQuantityCore(item.id, bad, identity);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/invalid quantity/i);
    }
    const row = await db.cartItem.findUnique({ where: { id: item.id } });
    expect(row?.quantity).toBe(2);
  });

  it("returns the same refusal for a missing item and someone else's item (no oracle)", async () => {
    const { item, cart } = await seedCartLine(2);

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
