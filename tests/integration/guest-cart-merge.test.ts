import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { mergeGuestCartCore } from "@/modules/cart/merge";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 5 (H: "guest cart never merged on login"): a guest builds a cart under
// the girah_guest_id cookie; signing in used to orphan it because identity
// resolves to {userId}. mergeGuestCartCore MOVES the guest lines into the
// account cart, then the (action-layer) wrapper clears the cookie.

async function seedGuestCart(guestId: string, lines: { variationId: string; quantity: number }[]) {
  const cart = await db.cart.create({ data: { guestId } });
  for (const line of lines) {
    await db.cartItem.create({ data: { cartId: cart.id, ...line } });
  }
  return cart;
}

describe("mergeGuestCartCore", () => {
  beforeEach(resetDb);

  it("moves disjoint guest lines into an existing user cart and deletes the guest cart", async () => {
    const user = await createTestUser();
    const a = await createTestProduct();
    const b = await createTestProduct();

    const userCart = await db.cart.create({ data: { userId: user.id } });
    await db.cartItem.create({ data: { cartId: userCart.id, variationId: a.variation.id, quantity: 2 } });
    await seedGuestCart("guest-1", [{ variationId: b.variation.id, quantity: 3 }]);

    await mergeGuestCartCore("guest-1", user.id);

    const merged = await db.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(merged).not.toBeNull();
    const byVariation = new Map(merged!.items.map((i) => [i.variationId, i.quantity]));
    expect(byVariation.get(a.variation.id)).toBe(2); // untouched
    expect(byVariation.get(b.variation.id)).toBe(3); // moved

    expect(await db.cart.findFirst({ where: { guestId: "guest-1" } })).toBeNull();
    expect(await db.cartItem.count({ where: { cartId: userCart.id } })).toBe(2);
  });

  it("sums quantities when both carts hold the same variation, clamped to 999", async () => {
    const user = await createTestUser();
    const { variation } = await createTestProduct();

    const userCart = await db.cart.create({ data: { userId: user.id } });
    await db.cartItem.create({ data: { cartId: userCart.id, variationId: variation.id, quantity: 600 } });
    await seedGuestCart("guest-sum", [{ variationId: variation.id, quantity: 500 }]);

    await mergeGuestCartCore("guest-sum", user.id);

    const line = await db.cartItem.findUnique({
      where: { cartId_variationId: { cartId: userCart.id, variationId: variation.id } },
    });
    expect(line?.quantity).toBe(999); // 1100 capped at MAX_QUANTITY
    expect(await db.cart.count({ where: { guestId: "guest-sum" } })).toBe(0);
  });

  it("creates the user cart and moves the lines when the account has none", async () => {
    const user = await createTestUser();
    const { variation } = await createTestProduct();
    const guestCart = await seedGuestCart("guest-orphan", [{ variationId: variation.id, quantity: 1 }]);

    await mergeGuestCartCore("guest-orphan", user.id);

    const userCart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(userCart).not.toBeNull();
    expect(userCart!.items).toHaveLength(1);
    expect(userCart!.items[0].quantity).toBe(1);
    // Guest cart row is gone — nothing to resurrect on a later login.
    expect(await db.cart.findUnique({ where: { id: guestCart.id } })).toBeNull();
  });

  it("is a no-op for a stale guest id (cookie with no cart)", async () => {
    const user = await createTestUser();
    const { variation } = await createTestProduct();
    const userCart = await db.cart.create({ data: { userId: user.id } });
    await db.cartItem.create({ data: { cartId: userCart.id, variationId: variation.id, quantity: 4 } });

    await mergeGuestCartCore("guest-stale", user.id);

    const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart!.items).toHaveLength(1);
    expect(cart!.items[0].quantity).toBe(4);
  });

  it("drops an empty guest cart instead of merging nothing", async () => {
    const user = await createTestUser();
    const guestCart = await db.cart.create({ data: { guestId: "guest-empty" } });

    await mergeGuestCartCore("guest-empty", user.id);

    expect(await db.cart.findUnique({ where: { id: guestCart.id } })).toBeNull();
    // No user cart is created from an empty guest cart.
    expect(await db.cart.findUnique({ where: { userId: user.id } })).toBeNull();
  });

  it("keeps the account cart intact when the same cart already carries both keys", async () => {
    const user = await createTestUser();
    const { variation } = await createTestProduct();
    // Defensive branch: cart already linked to this user but still marked guest.
    const cart = await db.cart.create({ data: { userId: user.id, guestId: "guest-both" } });
    await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity: 2 } });

    await mergeGuestCartCore("guest-both", user.id);

    const after = await db.cart.findUnique({ where: { id: cart.id }, include: { items: true } });
    expect(after!.guestId).toBeNull();
    expect(after!.userId).toBe(user.id);
    expect(after!.items[0].quantity).toBe(2); // no double-merge
  });
});
