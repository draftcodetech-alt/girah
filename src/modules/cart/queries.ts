import { db } from "@/lib/db";
import { resolveCartIdentityReadOnly } from "./identity";
import type { CartIdentity } from "./identity";
import type { CartView } from "./types";

// Plain core (Phase 5): takes an explicit identity so tests can run without
// a Next request scope — getCart() below is the thin request wrapper.
export async function getCartFor(identity: CartIdentity | null): Promise<CartView> {
  if (!identity) return { items: [], subtotal: 0 };

  const cart = await db.cart.findFirst({
    where: identity,
    include: {
      items: {
        include: {
          variation: {
            include: {
              product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
            },
          },
        },
      },
    },
  });

  if (!cart) return { items: [], subtotal: 0 };

  const items = cart.items.map((item) => ({
    id: item.id,
    variationId: item.variationId,
    productName: item.variation.product.name,
    productSlug: item.variation.product.slug,
    variationName: item.variation.name,
    imageUrl: item.variation.product.images[0]?.url ?? null,
    unitPrice: item.variation.price,
    quantity: item.quantity,
    subtotal: item.variation.price * item.quantity,
    isEnabled: item.variation.isEnabled,
  }));

  return { items, subtotal: items.reduce((sum, i) => sum + i.subtotal, 0) };
}

export async function getCart(): Promise<CartView> {
  const identity = await resolveCartIdentityReadOnly();
  return getCartFor(identity);
}

export async function getCartItemCount(): Promise<number> {
  // Header badge: runs on EVERY page, so this must stay cheap — an id-only
  // lookup plus a SUM, never the full nested cart view with images.
  const identity = await resolveCartIdentityReadOnly();
  if (!identity) return 0;
  const cart = await db.cart.findFirst({ where: identity, select: { id: true } });
  if (!cart) return 0;
  const result = await db.cartItem.aggregate({
    _sum: { quantity: true },
    where: { cartId: cart.id },
  });
  return result._sum.quantity ?? 0;
}
