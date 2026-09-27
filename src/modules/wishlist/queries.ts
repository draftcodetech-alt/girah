import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CARD_PRODUCT_INCLUDE, toProductListItem } from "@/modules/catalog";
import type { ProductListItem } from "@/modules/catalog";

// Phase 15: wishlist reads. Auth-first — a signed-out caller gets empty
// results (the /wishlist page additionally redirects via the proxy), so no
// query here can ever surface another account's saved items.

/** Card-shaped products saved by the current user, newest save first. */
export async function getWishlistProducts(): Promise<ProductListItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const rows = await db.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: { product: { include: CARD_PRODUCT_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toProductListItem(row.product));
}

/** Just the product ids — for the filled/outline heart state on product cards. */
export async function getWishlistProductIds(): Promise<string[]> {
  const session = await auth();
  if (!session?.user) return [];

  const rows = await db.wishlistItem.findMany({
    where: { userId: session.user.id },
    select: { productId: true },
  });
  return rows.map((row) => row.productId);
}
