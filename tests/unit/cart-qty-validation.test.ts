import { describe, it, expect } from "vitest";
import { addToCart, updateCartItemQuantity } from "@/modules/cart/actions";

// Phase 1 C1: server actions are HTTP endpoints — crafted quantities
// (negative, zero, fractional, absurd) must be rejected before they can
// reach the DB, where a negative value would inflate stock at checkout.

const VARIATION_ID = "test-variation-id";
const CART_ITEM_ID = "test-cart-item-id";

const INVALID_QUANTITIES: number[] = [-50, -1, 0, 1.5, NaN, Infinity, 100000];

describe("addToCart quantity validation", () => {
  it.each(INVALID_QUANTITIES.map((q) => [String(q), q]))(
    "rejects requestedQuantity=%s",
    async (_label, quantity) => {
      const result = await addToCart(VARIATION_ID, quantity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid quantity.");
      }
    }
  );
});

describe("updateCartItemQuantity validation", () => {
  const invalid: number[] = [-1, -50, 1.5, NaN, Infinity, 100000];

  it.each(invalid.map((q) => [String(q), q]))(
    "rejects quantity=%s",
    async (_label, quantity) => {
      const result = await updateCartItemQuantity(CART_ITEM_ID, quantity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid quantity.");
      }
    }
  );
});
