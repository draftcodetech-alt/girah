import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CartIdentity } from "./identity";
import type { CartActionResult } from "./types";

// Hard ceiling for a single cart line — well above any realistic order,
// small enough to keep crafted payloads from overflowing the Int column.
export const MAX_QUANTITY = 999;

export function isValidQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isInteger(q) && q >= 0 && q <= MAX_QUANTITY;
}

export async function getOrCreateCart(identity: CartIdentity) {
  const existing = await db.cart.findFirst({ where: identity });
  if (existing) return existing;
  return db.cart.create({ data: identity });
}

export function ownsCart(
  identity: CartIdentity,
  cart: { userId: string | null; guestId: string | null }
) {
  if ("userId" in identity) return cart.userId === identity.userId;
  return cart.guestId === identity.guestId;
}

// Phase 5 qty-0: plain core (no request context / revalidatePath) so the
// behaviour is testable without a Next server — same pattern as
// placeOrderCore / updateOrderStatusCore (Phase 2).
export async function updateCartItemQuantityCore(
  cartItemId: string,
  quantity: number,
  identity: CartIdentity
): Promise<CartActionResult> {
  // 0 means "remove" (removeCartItem delegates here); anything non-integer,
  // negative, or absurd is rejected before it can reach the DB. (C1)
  if (!isValidQuantity(quantity)) {
    return { success: false, error: "Invalid quantity." };
  }

  try {
    const item = await db.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true, variation: true },
    });

    // Phase 4 L9: a missing item and someone else's item used to return
    // DIFFERENT responses (success vs error), turning these actions into an
    // existence oracle for crafted cart-item ids. Both cases now return the
    // exact same refusal — only items in the caller's own cart ever resolve.
    if (!item || !ownsCart(identity, item.cart)) {
      return { success: false, error: "Item not found in your cart." };
    }

    if (quantity < 1) {
      await db.cartItem.delete({ where: { id: cartItemId } });
    } else {
      const cappedQuantity = Math.min(quantity, item.variation.stock);
      // Phase 5 qty-0: stock has dropped to 0 since this line was added —
      // capping would compute 0 and trip the DB CHECK (quantity >= 1),
      // surfacing a generic failure. Refuse with an actionable message
      // instead; the user removes the line via Remove (qty 0 → delete above).
      if (cappedQuantity < 1) {
        return {
          success: false,
          error: "This item is out of stock — remove it from your cart or try again later.",
        };
      }
      await db.cartItem.update({ where: { id: cartItemId }, data: { quantity: cappedQuantity } });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: true };
    }
    console.error("updateCartItemQuantityCore failed — full error:", error);
    return { success: false, error: "Something went wrong updating your cart. Please try again." };
  }
}
