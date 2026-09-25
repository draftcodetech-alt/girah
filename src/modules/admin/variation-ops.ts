import { db } from "@/lib/db";
import type { AdminActionResult } from "./products";
import { stockAdjustmentSchema } from "./schema";

export class NegativeStockError extends Error {
  constructor() {
    super("Adjustment would result in negative stock.");
    this.name = "NegativeStockError";
  }
}

export class VariationNotFoundError extends Error {
  constructor() {
    super("Variation not found.");
    this.name = "VariationNotFoundError";
  }
}

/**
 * Core of `adjustStock`, extracted from the "use server" wrapper so the
 * concurrency behaviour can be integration-tested without Next request
 * context. Auth is the caller's job (requireAdmin → adminId).
 *
 * Single atomic UPDATE (stock = stock + n) instead of read-then-write:
 * concurrent adjustments can no longer lose updates (the row lock serializes
 * them), and a follow-up read in the same transaction (where we still hold
 * that lock) yields exact previous/new values for the audit trail. Negative
 * results are rejected by a conditional WHERE (same idiom as
 * decrementStockForItems) so the friendly error is deterministic even under
 * races — the stock_non_negative CHECK constraint stays as the DB backstop.
 */
export async function adjustStockCore(
  variationId: string,
  input: unknown,
  adminId: string
): Promise<AdminActionResult> {
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const { adjustment, reason } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const updated = await tx.productVariation.updateMany({
          where: {
            id: variationId,
            ...(adjustment < 0 ? { stock: { gte: -adjustment } } : {}),
          },
          data: { stock: { increment: adjustment } },
        });
        if (updated.count === 0) {
          const exists = await tx.productVariation.findUnique({
            where: { id: variationId },
            select: { id: true },
          });
          if (!exists) throw new VariationNotFoundError();
          throw new NegativeStockError();
        }
        const row = await tx.productVariation.findUniqueOrThrow({
          where: { id: variationId },
          select: { stock: true },
        });
        await tx.stockAdjustment.create({
          data: {
            variationId,
            previousStock: row.stock - adjustment,
            adjustment,
            newStock: row.stock,
            reason,
            adminId,
          },
        });
      },
      { maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (error instanceof NegativeStockError || error instanceof VariationNotFoundError) {
      return { success: false, error: error.message };
    }
    console.error("adjustStockCore failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Adjustment failed." };
  }

  return { success: true };
}
