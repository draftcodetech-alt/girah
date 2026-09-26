import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { getCartFor } from "@/modules/cart/queries";
import { placeOrderCore } from "@/modules/checkout/place-order";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 5 disabled-line UX: cart lines whose variation was disabled by an
// admin must be identifiable by the cart UI (isEnabled flag) — previously
// they looked normal and only failed at checkout with a generic message.
// The checkout failure must now NAME the item so the fix is obvious.

const checkoutData: CheckoutInput = {
  fullName: "Disabled Line",
  phone: "03001234567",
  email: "disabledline@girah.test",
  address: "Street 3",
  city: "Karachi",
  postalCode: "",
  deliveryNotes: "",
  paymentMethod: "COD",
};

describe("getCartFor — disabled lines", () => {
  beforeEach(resetDb);

  it("reports isEnabled=false for a line whose variation was disabled after adding", async () => {
    const { variation } = await createTestProduct();
    const cart = await db.cart.create({ data: { guestId: "guest-disabled" } });
    await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity: 2 } });

    await db.productVariation.update({
      where: { id: variation.id },
      data: { isEnabled: false },
    });

    const view = await getCartFor({ guestId: "guest-disabled" });
    expect(view.items).toHaveLength(1);
    expect(view.items[0].isEnabled).toBe(false);
    // Line stays visible (and in the subtotal) — Remove is the user's exit.
    expect(view.items[0].quantity).toBe(2);
    expect(view.subtotal).toBeGreaterThan(0);
  });

  it("reports isEnabled=true and full stock for a healthy line", async () => {
    const { variation } = await createTestProduct();
    const cart = await db.cart.create({ data: { guestId: "guest-healthy" } });
    await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity: 1 } });

    const view = await getCartFor({ guestId: "guest-healthy" });
    expect(view.items[0].isEnabled).toBe(true);
    expect(view.items[0].availableStock).toBe(variation.stock);
  });

  it("returns an empty cart for a null identity", async () => {
    const view = await getCartFor(null);
    expect(view).toEqual({ items: [], subtotal: 0 });
  });

  it("checkout failure NAMES the disabled item (not a generic \"some items\")", async () => {
    const { product, variation } = await createTestProduct();
    const guestId = "guest-named-error";
    const cart = await db.cart.create({ data: { guestId } });
    await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity: 1 } });
    await db.productVariation.update({
      where: { id: variation.id },
      data: { isEnabled: false },
    });

    const result = await placeOrderCore(checkoutData, { guestId });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(product.name);
      expect(result.error).toContain(variation.name);
      expect(result.error).toMatch(/no longer available/i);
    }
    // Nothing was ordered and the line survives for the user to remove.
    expect(await db.order.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(1);
  });
});
