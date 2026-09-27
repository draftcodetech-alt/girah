"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type WishlistActionResult =
  | { success: true; added: boolean }
  | { success: false; error: string };

/**
 * Phase 15: add/remove a product from the signed-in user's wishlist.
 * Auth-first (guests get a friendly refusal — the /wishlist page itself is
 * proxy-gated to /login). The unique (userId, productId) pair makes the
 * toggle idempotent: a double-clicked heart that races its own insert loses
 * into P2002 and reports `added: true` rather than creating a duplicate or
 * failing the user's click.
 */
export async function toggleWishlist(productId: string): Promise<WishlistActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }
  if (typeof productId !== "string" || productId.length === 0) {
    return { success: false, error: "Product not found." };
  }

  const userId = session.user.id;
  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) {
    // deleteMany: a concurrent duplicate removal can't throw a not-found.
    await db.wishlistItem.deleteMany({ where: { id: existing.id } });
    return { success: true, added: false };
  }

  try {
    await db.wishlistItem.create({ data: { userId, productId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Lost the race against our own double-click — the row exists, which
      // is exactly what `added: true` promises.
      return { success: true, added: true };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { success: false, error: "Product not found." };
    }
    throw error;
  }
  return { success: true, added: true };
}
