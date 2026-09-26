import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { getProducts } from "@/modules/catalog";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 5 float-price fix: shop/page.tsx converts rupees to paisa with
// `Number(x) * 100`, which for 8.3 yields 830.0000000000001 — a float that
// silently failed integer comparisons (product priced 830 paisa excluded by
// minPrice "8.3"). sanitizeFilters now rounds to whole paisa at the single
// choke point every caller passes through.

async function productAtPrice(pricePaisa: number) {
  const { product, variation, category } = await createTestProduct();
  await db.productVariation.update({ where: { id: variation.id }, data: { price: pricePaisa } });
  return { product, variation, category };
}

describe("getProducts — price filter sanitization", () => {
  beforeEach(resetDb);

  it("rounds float paisa so a boundary product is NOT excluded", async () => {
    const { product } = await productAtPrice(830);
    await productAtPrice(2_000);

    // Exactly the float artifact: 8.3 * 100 === 830.0000000000001 in IEEE754.
    const floatPaisa = Number("8.3") * 100;
    expect(floatPaisa).not.toBe(830); // guard: the bug scenario is real

    const results = await getProducts({ minPrice: floatPaisa });
    const ids = results.map((p) => p.id);
    expect(ids).toContain(product.id); // rounding fixed the false exclusion
  });

  it("applies the rounded minPrice boundary exactly (829 excluded, 830 included)", async () => {
    const onBoundary = await productAtPrice(830);
    const below = await productAtPrice(829);

    const results = await getProducts({ minPrice: Number("8.3") * 100 });
    const ids = results.map((p) => p.id);
    expect(ids).toContain(onBoundary.product.id);
    expect(ids).not.toContain(below.product.id);
  });

  it("drops NaN / negative / non-finite price filters instead of matching nothing", async () => {
    const { product } = await productAtPrice(500);

    for (const bad of [Number.NaN, Number.NEGATIVE_INFINITY, -1]) {
      const results = await getProducts({ minPrice: bad });
      expect(results.map((p) => p.id)).toContain(product.id);
    }
  });

  it("keeps maxPrice rounding symmetric", async () => {
    const { product } = await productAtPrice(1_099);
    const above = await productAtPrice(1_100);

    // 10.99 * 100 === 1099 (exact here), but rounding must not widen it either.
    const results = await getProducts({ maxPrice: Number("10.99") * 100 });
    const ids = results.map((p) => p.id);
    expect(ids).toContain(product.id);
    expect(ids).not.toContain(above.product.id);
  });
});
