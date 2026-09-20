import { Prisma } from "@prisma/client";

export type PricedLine = {
  variationId: string;
  productName: string;
  variationName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

// Takes a transaction client, not the global db — pricing must be computed
// inside the SAME transaction as the stock decrement + order creation, so
// there's no gap where a price could change between reading and committing.
export async function priceCartItemsFresh(
  tx: Prisma.TransactionClient,
  items: { variationId: string; quantity: number }[]
) {
  const variations = await tx.productVariation.findMany({
    where: { id: { in: items.map((i) => i.variationId) } },
    include: { product: true },
  });

  const lines: PricedLine[] = items.map((item) => {
    const variation = variations.find((v) => v.id === item.variationId);
    if (!variation || !variation.isEnabled) {
      throw new UnavailableVariationError(item.variationId);
    }
    return {
      variationId: variation.id,
      productName: variation.product.name,
      variationName: variation.name,
      unitPrice: variation.price,
      quantity: item.quantity,
      subtotal: variation.price * item.quantity,
    };
  });

  return { lines, subtotal: lines.reduce((sum, l) => sum + l.subtotal, 0) };
}

export class UnavailableVariationError extends Error {
  constructor(public variationId: string) {
    super(`Variation ${variationId} is no longer available.`);
    this.name = "UnavailableVariationError";
  }
}
