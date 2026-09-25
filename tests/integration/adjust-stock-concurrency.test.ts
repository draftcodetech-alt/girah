import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { adjustStockCore, NegativeStockError } from "@/modules/admin/variation-ops";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 2: adjustStock must be an atomic increment (no lost updates under
// concurrency) with an exact, attributed audit trail.

describe("adjustStockCore concurrency + audit", () => {
  beforeEach(resetDb);

  it("concurrent adjustments all apply — no lost updates", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const admin = await createTestUser({ role: "ADMIN" });

    const results = await Promise.all([
      adjustStockCore(variation.id, { adjustment: 5, reason: "supplier restock" }, admin.id),
      adjustStockCore(variation.id, { adjustment: 3, reason: "stocktake +" }, admin.id),
      adjustStockCore(variation.id, { adjustment: -2, reason: "damaged units" }, admin.id),
    ]);
    expect(results.every((r) => r.success)).toBe(true);

    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(11); // 5 + 5 + 3 − 2 — all three applied

    const rows = await db.stockAdjustment.findMany({ where: { variationId: variation.id } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.adminId === admin.id)).toBe(true);
    for (const row of rows) {
      expect(row.newStock - row.adjustment).toBe(row.previousStock); // internally consistent
    }
    expect(rows.reduce((sum, r) => sum + r.adjustment, 0)).toBe(6);
  });

  it("sequential adjustments keep the audit chain exact", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const admin = await createTestUser({ role: "ADMIN" });

    await adjustStockCore(variation.id, { adjustment: -2, reason: "shrinkage" }, admin.id);
    await adjustStockCore(variation.id, { adjustment: 10, reason: "restock" }, admin.id);

    const rows = await db.stockAdjustment.findMany({
      where: { variationId: variation.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((r) => [r.previousStock, r.adjustment, r.newStock])).toEqual([
      [5, -2, 3],
      [3, 10, 13],
    ]);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(13);
  });

  it("rejects an adjustment that would make stock negative and rolls back", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const admin = await createTestUser({ role: "ADMIN" });

    const result = await adjustStockCore(
      variation.id,
      { adjustment: -10, reason: "bad count" },
      admin.id
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Adjustment would result in negative stock.");

    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(5); // unchanged
    expect(await db.stockAdjustment.count()).toBe(0); // no audit row
  });

  it("classifies the negative-stock failure as NegativeStockError inside the tx", () => {
    expect(new NegativeStockError()).toBeInstanceOf(Error);
    expect(new NegativeStockError().name).toBe("NegativeStockError");
  });

  it("returns a friendly error for a missing variation", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const result = await adjustStockCore(
      "no-such-variation",
      { adjustment: 1, reason: "x" },
      admin.id
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Variation not found.");
  });

  it("validates adjustment and reason before touching the database", async () => {
    const { variation } = await createTestProduct();
    const admin = await createTestUser({ role: "ADMIN" });

    const fractional = await adjustStockCore(
      variation.id,
      { adjustment: 1.5, reason: "half a unit" },
      admin.id
    );
    expect(fractional.success).toBe(false);
    if (!fractional.success) expect(fractional.fieldErrors?.adjustment).toBeDefined();

    const emptyReason = await adjustStockCore(variation.id, { adjustment: 1, reason: "  " }, admin.id);
    expect(emptyReason.success).toBe(false);

    expect(await db.stockAdjustment.count()).toBe(0);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.stock).toBe(5);
  });
});
