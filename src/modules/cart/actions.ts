"use server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { resolveCartIdentity } from "./identity";
import type { CartIdentity } from "./identity";
import type { CartActionResult } from "./types";

async function getOrCreateCart(identity: CartIdentity) {
  const existing = await db.cart.findFirst({ where: identity });
  if (existing) return existing;
  return db.cart.create({ data: identity });
}

function ownsCart(identity: CartIdentity, cart: { userId: string | null; guestId: string | null }) {
  if ("userId" in identity) return cart.userId === identity.userId;
  return cart.guestId === identity.guestId;
}

// Hard ceiling for a single cart line — well above any realistic order,
// small enough to keep crafted payloads from overflowing the Int column.
const MAX_QUANTITY = 999;

function isValidQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isInteger(q) && q >= 0 && q <= MAX_QUANTITY;
}

export async function addToCart(
  variationId: string,
  requestedQuantity: number
): Promise<CartActionResult> {
  // Server actions are plain HTTP endpoints — never trust the client to send
  // a sane quantity. A negative value would pass Math.min(..., stock) below,
  // then inflate stock via `stock: { decrement: negative }` at checkout. (C1)
  if (!isValidQuantity(requestedQuantity) || requestedQuantity < 1) {
    return { success: false, error: "Invalid quantity." };
  }

  try {
    const identity = await resolveCartIdentity();

    // Server ALWAYS re-checks live stock — never trusts the client. girah.md §3.6/§3.7.
    const variation = await db.productVariation.findUnique({ where: { id: variationId } });
    if (!variation || !variation.isEnabled || variation.stock <= 0) {
      return { success: false, error: "This item is no longer available." };
    }

    const cart = await getOrCreateCart(identity);

    const existingItem = await db.cartItem.findUnique({
      where: { cartId_variationId: { cartId: cart.id, variationId } },
    });

    const desiredQuantity = (existingItem?.quantity ?? 0) + requestedQuantity;
    const cappedQuantity = Math.min(desiredQuantity, variation.stock);

    if (existingItem) {
      await db.cartItem.update({ where: { id: existingItem.id }, data: { quantity: cappedQuantity } });
    } else {
      await db.cartItem.create({ data: { cartId: cart.id, variationId, quantity: cappedQuantity } });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("addToCart failed:", error);
    return { success: false, error: "Something went wrong updating your cart. Please try again." };
  }
}

export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<CartActionResult> {
  // 0 means "remove" (removeCartItem delegates here); anything non-integer,
  // negative, or absurd is rejected before it can reach the DB. (C1)
  if (!isValidQuantity(quantity)) {
    return { success: false, error: "Invalid quantity." };
  }

  try {
    const identity = await resolveCartIdentity();

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
      await db.cartItem.update({ where: { id: cartItemId }, data: { quantity: cappedQuantity } });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      revalidatePath("/", "layout");
      return { success: true };
    }
    console.error("updateCartItemQuantity failed — full error:", error);
    return { success: false, error: "Something went wrong updating your cart. Please try again." };
  }
}
export async function removeCartItem(cartItemId: string): Promise<CartActionResult> {
  return updateCartItemQuantity(cartItemId, 0);
}
