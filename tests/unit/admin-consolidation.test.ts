import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Phase B: consolidation + helper-adoption guards for the admin cleanup.
// Behavior is covered by integration suites; these pin the structure so the
// duplication cannot silently return.
const ROOT = process.cwd();
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("admin consolidation", () => {
  it("getAdminCategories gates then delegates to the catalog reader", () => {
    const source = readSource("src/modules/admin/products.ts");
    expect(source).toContain('import { getCategories } from "@/modules/catalog"');
    expect(source).not.toMatch(/db\.category\.findMany/);
  });

  it("all admin zod rejections flow through the shared helper", () => {
    for (const file of [
      "src/modules/admin/products.ts",
      "src/modules/admin/variations.ts",
      "src/modules/admin/categories.ts",
    ]) {
      const source = readSource(file);
      expect(source).toContain('from "./field-errors"');
      expect(source).not.toMatch(/for \(const issue of parsed\.error\.issues\)/);
    }
  });

  it("no admin module duplicates the category table read", () => {
    const products = readSource("src/modules/admin/products.ts");
    // The only category reads allowed here are the delegated one (import)
    // and the with-counts list owned by categories.ts.
    expect(products).not.toMatch(/db\.category\.(findMany|findFirst|findUnique)/);
  });
});

describe("catalog read guards", () => {
  it("missing slugs resolve to null for the page to turn into a 404", () => {
    const source = readSource("src/modules/catalog/queries.ts");
    expect(source).toContain("if (!product) return null");
  });

  it("card images stay bounded to one thumbnail per product", () => {
    const source = readSource("src/modules/catalog/queries.ts");
    expect(source).toMatch(/take:\s*1/);
  });
});
