import { Prisma } from "@prisma/client";

// Decrements stock for every line inside the SAME transaction as pricing/order
// creation, always processing rows in a FIXED, SORTED order (by variationId).
// This is the Deadlock-Prevention Principle: two concurrent checkouts touching
// overlapping variations will always attempt to lock rows in the same global
// order, so neither can end up waiting on a lock the other already holds
// while it waits on them — no circular wait, no deadlock.
//
// Each decrement is a single atomic conditional UPDATE (`WHERE stock >= qty`).
// Postgres serializes concurrent writes to the same row at the row-lock level
// under READ COMMITTED, so this pattern doesn't produce serialization errors
// the way SERIALIZABLE isolation would — no explicit retry loop is needed
// here; the atomicity of the conditional UPDATE itself is what's safe.
export async function decrementStockForItems(
  tx: Prisma.TransactionClient,
  items: { variationId: string; quantity: number }[]
): Promise<void> {
  const sorted = [...items].sort((a, b) => a.variationId.localeCompare(b.variationId));

  for (const item of sorted) {
    const result = await tx.productVariation.updateMany({
      where: { id: item.variationId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count === 0) {
      throw new InsufficientStockError(item.variationId);
    }
  }
}

export class InsufficientStockError extends Error {
  constructor(public variationId: string) {
    super(`Insufficient stock for variation ${variationId}`);
    this.name = "InsufficientStockError";
  }
}
