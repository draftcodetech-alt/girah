import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { decrementStockForItems, InsufficientStockError } from "@/modules/checkout/stock";

// Phase B: the deadlock-prevention contract (sorted variationId order) and
// the atomic-conditional-update contract (count 0 → throw), verified against
// a stub transaction client — no database needed.
function mockTx(counts: Record<string, number> = {}) {
  const calls: string[] = [];
  const updateMany = vi.fn(async (args: { where: { id: string } }) => {
    calls.push(args.where.id);
    return { count: counts[args.where.id] ?? 1 };
  });
  const tx = { productVariation: { updateMany } } as unknown as Prisma.TransactionClient;
  return { calls, tx, updateMany };
}

describe("decrementStockForItems", () => {
  it("locks rows in sorted variationId order regardless of input order", async () => {
    const { tx, calls } = mockTx();
    await decrementStockForItems(tx, [
      { variationId: "v3", quantity: 1 },
      { variationId: "v1", quantity: 2 },
      { variationId: "v2", quantity: 1 },
    ]);
    expect(calls).toEqual(["v1", "v2", "v3"]);
  });

  it("decrements by the exact line quantity", async () => {
    const { tx, updateMany } = mockTx();
    await decrementStockForItems(tx, [{ variationId: "v9", quantity: 3 }]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "v9", stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
  });

  it("throws InsufficientStockError when the conditional update claims nothing", async () => {
    const { tx } = mockTx({ v1: 0 });
    const error = await decrementStockForItems(tx, [{ variationId: "v1", quantity: 5 }]).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(InsufficientStockError);
    expect(error.variationId).toBe("v1");
  });
});
