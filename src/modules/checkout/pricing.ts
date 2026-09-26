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
    // Defense-in-depth (Phase 1 C1): cart quantities are validated at the
    // action layer and constrained by a DB CHECK, but pricing must never
    // compute a negative or fractional subtotal even if a bad row slips in.
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new InvalidQuantityError(item.variationId);
    }
    const variation = variations.find((v) => v.id === item.variationId);
    if (!variation || !variation.isEnabled) {
      throw new UnavailableVariationError(
        item.variationId,
        variation ? `${variation.product.name} — ${variation.name}` : undefined
      );
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
  // Phase 5 disabled-line UX: carry a human label (product — variation) when
  // the row still exists so placeOrderCore can NAME the item in its message
  // instead of failing with a generic "some items" notice.
  constructor(
    public variationId: string,
    public itemLabel?: string
  ) {
    super(`Variation ${variationId} is no longer available.`);
    this.name = "UnavailableVariationError";
  }
}

export class InvalidQuantityError extends Error {
  constructor(public variationId: string) {
    super(`Invalid quantity for variation ${variationId}.`);
    this.name = "InvalidQuantityError";
  }
}
