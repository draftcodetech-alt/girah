import { db } from "@/lib/db";
import { resolveCartIdentityReadOnly } from "./identity";
import type { CartView } from "./types";

export async function getCart(): Promise<CartView> {
  const identity = await resolveCartIdentityReadOnly();
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
    availableStock: item.variation.stock,
  }));

  return { items, subtotal: items.reduce((sum, i) => sum + i.subtotal, 0) };
}

export async function getCartItemCount(): Promise<number> {
  const cart = await getCart();
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}
