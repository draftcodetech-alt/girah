import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 1 C1: application validation is the primary guard, but the DB CHECK
// constraint makes negative/zero cart quantities impossible even if a
// crafted request somehow bypasses the action layer.

async function createCart(guestId: string) {
  return db.cart.create({ data: { guestId } });
}

describe("CartItem.quantity CHECK constraint", () => {
  beforeEach(resetDb);

  it("rejects negative quantities", async () => {
    const { variation } = await createTestProduct();
    const cart = await createCart(`guest-neg-${Date.now()}`);

    await expect(
      db.cartItem.create({
        data: { cartId: cart.id, variationId: variation.id, quantity: -5 },
      })
    ).rejects.toThrow();
  });

  it("rejects zero quantities", async () => {
    const { variation } = await createTestProduct();
    const cart = await createCart(`guest-zero-${Date.now()}`);

    await expect(
      db.cartItem.create({
        data: { cartId: cart.id, variationId: variation.id, quantity: 0 },
      })
    ).rejects.toThrow();
  });

  it("accepts positive quantities", async () => {
    const { variation } = await createTestProduct();
    const cart = await createCart(`guest-ok-${Date.now()}`);

    const item = await db.cartItem.create({
      data: { cartId: cart.id, variationId: variation.id, quantity: 3 },
    });
    expect(item.quantity).toBe(3);
  });
});
