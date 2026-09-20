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

export async function addToCart(
  variationId: string,
  requestedQuantity: number
): Promise<CartActionResult> {
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
}

export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<CartActionResult> {
  try {
    const identity = await resolveCartIdentity();

    const item = await db.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true, variation: true },
    });

    if (!item) {
      return { success: true };
    }

    if (!ownsCart(identity, item.cart)) {
      return { success: false, error: "Cart item not found." };
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
