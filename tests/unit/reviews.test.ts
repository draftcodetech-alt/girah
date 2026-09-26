import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { formatReviewerName } from "@/modules/reviews";

// Phase 10 (reviews): reviewer-name privacy rule + source guards for the
// submission gate, moderation queue and card-rating wiring.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("formatReviewerName", () => {
  it("renders first name + last initial", () => {
    expect(formatReviewerName("Ayesha Khan")).toBe("Ayesha K.");
  });

  it("keeps only the first and last token for middle names", () => {
    expect(formatReviewerName("Ayesha Bibi Khan")).toBe("Ayesha K.");
  });

  it("returns a single token as-is", () => {
    expect(formatReviewerName("Madam")).toBe("Madam");
  });

  it("uppercases a one-letter last name", () => {
    expect(formatReviewerName("Ali b")).toBe("Ali B.");
  });

  it("falls back to Anonymous for blank/missing names", () => {
    expect(formatReviewerName("")).toBe("Anonymous");
    expect(formatReviewerName("   ")).toBe("Anonymous");
    expect(formatReviewerName(null)).toBe("Anonymous");
    expect(formatReviewerName(undefined)).toBe("Anonymous");
  });

  it("tolerates irregular whitespace", () => {
    expect(formatReviewerName("  Ayesha   Khan  ")).toBe("Ayesha K.");
  });
});

describe("Phase 10: storefront wiring", () => {
  it("product page renders the reviews section from the reviews module", () => {
    const source = readSource("src/app/(storefront)/product/[slug]/page.tsx");
    expect(source).toContain('from "@/modules/reviews"');
    expect(source).toMatch(/id="reviews-heading"/);
    expect(source).toMatch(/You may also like/);
    expect(source).toMatch(/Only verified buyers can review this item/);
  });

  it("storefront queries only expose APPROVED reviews", () => {
    const queries = readSource("src/modules/reviews/queries.ts");
    expect(queries).toContain('status: "APPROVED"');
    const catalog = readSource("src/modules/catalog/queries.ts");
    expect(catalog).toContain('reviews: { where: { status: "APPROVED" }');
  });

  it("submitReview re-checks the purchase gate and upserts one row", () => {
    const source = readSource("src/modules/reviews/actions.ts");
    expect(source).toMatch(/hasVerifiedPurchase/);
    expect(source).toMatch(/review\.upsert/);
    expect(source).toMatch(/status: "PENDING"/);
  });

  it("ReviewForm reports failures via Field and success via role=status", () => {
    const source = readSource("src/components/storefront/ReviewForm.tsx");
    expect(source).toMatch(/"use client"/);
    expect(source).toMatch(/error=\{state\?\.success === false \? state\.error : null\}/);
    expect(source).toMatch(/role="status"/);
    expect(source).toMatch(/awaiting approval/);
  });

  it("ProductCard only renders a star line when reviews exist", () => {
    const source = readSource("src/components/storefront/ProductCard.tsx");
    expect(source).toMatch(/product\.ratingCount > 0/);
    expect(source).toMatch(/aria-label=\{`Rated/);
  });

  it("ProductListItem carries the rating fields", () => {
    const source = readSource("src/modules/catalog/types.ts");
    expect(source).toMatch(/ratingAverage: number \| null/);
    expect(source).toMatch(/ratingCount: number/);
  });
});

describe("Phase 10: admin moderation", () => {
  it("the admin reviews page is no longer a stub", () => {
    const source = readSource("src/app/admin/reviews/page.tsx");
    expect(source).toMatch(/getAdminReviews/);
    expect(source).toMatch(/ReviewRow/);
    expect(source).not.toMatch(/return <h1/);
    expect(existsSync(join(ROOT, "src/components/admin/ReviewRow.tsx"))).toBe(true);
  });

  it("both admin review entry points go through requireAdmin", () => {
    const source = readSource("src/modules/admin/reviews.ts");
    const gates = source.match(/await requireAdmin\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  it("moderation failures surface as role=alert", () => {
    const source = readSource("src/components/admin/ReviewRow.tsx");
    expect(source).toMatch(/"use client"/);
    expect(source).toMatch(/role="alert"/);
    expect(source).toMatch(/setReviewStatus/);
  });
});
