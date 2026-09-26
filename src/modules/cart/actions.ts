"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { resolveCartIdentity } from "./identity";
import type { CartActionResult } from "./types";
import {
  getOrCreateCart,
  isValidQuantity,
  updateCartItemQuantityCore,
} from "./ops";

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
  // C1 ordering: validate BEFORE cookies()/DB — a crafted quantity is refused
  // without ever touching request context. The core re-validates (defense in
  // depth) and owns ownership/qty-0 logic; this wrapper only adds identity + revalidate.
  if (!isValidQuantity(quantity)) {
    return { success: false, error: "Invalid quantity." };
  }

  try {
    const identity = await resolveCartIdentity();
    const result = await updateCartItemQuantityCore(cartItemId, quantity, identity);
    if (result.success) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("updateCartItemQuantity failed — full error:", error);
    return { success: false, error: "Something went wrong updating your cart. Please try again." };
  }
}

export async function removeCartItem(
  cartItemId: string
): Promise<CartActionResult> {
  return updateCartItemQuantity(cartItemId, 0);
}
