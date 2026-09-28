import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17: SEO surface — robots, sitemap, root metadata, noindex on
// thin/session pages, per-product titles. Source guards (the live XML/HTML
// output is covered by E2E section 21).

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Phase 17: robots.txt", () => {
  const robots = readSource("src/app/robots.ts");

  it("exists as an App Router metadata route", () => {
    expect(existsSync(join(ROOT, "src/app/robots.ts"))).toBe(true);
  });

  it("crawls the storefront but skips private/funnel routes", () => {
    expect(robots).toContain('allow: "/"');
    for (const blocked of [
      '"/admin/"',
      '"/account/"',
      '"/wishlist/"',
      '"/order/"',
      '"/search"',
      '"/cart"',
      '"/checkout"',
      '"/api/"',
    ]) {
      expect(robots).toContain(blocked);
    }
  });

  it("advertises the sitemap", () => {
    expect(robots).toContain("sitemap:");
    expect(robots).toContain("/sitemap.xml");
  });
});

describe("Phase 17: sitemap.ts", () => {
  const sitemap = readSource("src/app/sitemap.ts");

  it("is runtime-rendered so builds never need the database", () => {
    expect(sitemap).toContain('force-dynamic');
    expect(sitemap).toContain("db.product.findMany");
  });

  it("ships the six content pages and the shop", () => {
    for (const path of [
      '"/shop"',
      '"/about"',
      '"/contact"',
      '"/shipping"',
      '"/returns"',
      '"/privacy"',
      '"/terms"',
    ]) {
      expect(sitemap).toContain(path);
    }
  });

  it("emits product URLs from live slugs, never /search or order pages", () => {
    expect(sitemap).toContain("/product/");
    expect(sitemap).not.toContain('"/search"');
    expect(sitemap).not.toContain('"/order/');
  });
});

describe("Phase 17: root metadata", () => {
  const layout = readSource("src/app/layout.tsx");

  it("sets metadataBase from the app origin", () => {
    expect(layout).toContain("metadataBase:");
    expect(layout).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("uses a title template with a stable default", () => {
    expect(layout).toMatch(/template:\s*"%s · Girah"/);
    expect(layout).toContain('default: "Girah — Handmade Crochet"');
  });

  it("ships OpenGraph + Twitter card defaults with a real brand image", () => {
    expect(layout).toContain("openGraph:");
    expect(layout).toContain('siteName: "Girah"');
    expect(layout).toContain("twitter:");
    expect(layout).toContain('card: "summary_large_image"');
    expect(layout).toContain("/florals/sunflower.png");
  });

  it("indexes by default (per-page noindex is opt-in)", () => {
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*true/);
  });
});

describe("Phase 17: per-page noindex + titles", () => {
  const noindex = (file: string) => {
    const source = readSource(file);
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false/);
  };

  it("search is noindex", () => noindex("src/app/(storefront)/search/page.tsx"));
  it("cart is noindex", () => noindex("src/app/(storefront)/cart/page.tsx"));
  it("checkout is noindex", () => noindex("src/app/(storefront)/checkout/page.tsx"));

  it("shop and cart carry titles for the template", () => {
    expect(readSource("src/app/(storefront)/shop/page.tsx")).toContain('title: "Shop"');
    expect(readSource("src/app/(storefront)/search/page.tsx")).toContain('title: "Search"');
    expect(readSource("src/app/(storefront)/cart/page.tsx")).toContain('title: "Cart"');
    expect(readSource("src/app/(storefront)/checkout/page.tsx")).toContain('title: "Checkout"');
  });

  it("product pages generate unique metadata", () => {
    const product = readSource("src/app/(storefront)/product/[slug]/page.tsx");
    expect(product).toContain("generateMetadata");
    expect(product).toContain("openGraph:");
  });
});
