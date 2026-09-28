import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Phase 15: wishlist + dedicated /search page — module boundaries, auth
// order, proxy gating, and the header/sort/card wiring (source guards; the
// behaviour itself lives in tests/integration/wishlist.test.ts).

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("wishlist module boundaries", () => {
  const actions = readSource("src/modules/wishlist/actions.ts");

  it("actions is a server-action module exporting only async functions", () => {
    expect(actions).toMatch(/^"use server";/);
    expect(actions).toMatch(/export async function toggleWishlist/);
    expect(actions).not.toMatch(/export const /);
    expect(actions).not.toMatch(/export function /); // only `export async function`
    expect(actions).toMatch(/export type /);
  });

  it("checks the session before any database call", () => {
    expect(actions.indexOf("await auth()")).toBeLessThan(actions.indexOf("db.wishlistItem"));
    expect(actions).toContain('error: "You must be signed in."');
  });

  it("toggles on the unique pair and survives the P2002 race", () => {
    expect(actions).toContain("userId_productId");
    expect(actions).toContain('error.code === "P2002"');
    expect(actions).toContain('error.code === "P2003"'); // unknown product → not found
  });

  const queries = readSource("src/modules/wishlist/queries.ts");

  it("queries are auth-first and scope every read to the session user", () => {
    expect(queries).not.toMatch(/^"use server";/);
    expect(queries.indexOf("await auth()")).toBeLessThan(queries.indexOf("db.wishlistItem"));
    expect(queries).toMatch(/if \(!session\?\.user\) return \[\];/);
    expect(queries).toMatch(/userId: session\.user\.id/);
    // Card shape comes from the shared catalog mapper — no second mapping.
    expect(queries).toContain("toProductListItem");
    expect(queries).not.toContain("startingPrice =");
  });

  it("the barrel exposes actions and queries without leaking internals", () => {
    const barrel = readSource("src/modules/wishlist/index.ts");
    expect(barrel).toContain('export { toggleWishlist }');
    expect(barrel).toContain('export { getWishlistProducts, getWishlistProductIds }');
    expect(barrel).toContain("export type { WishlistActionResult }");
  });
});

describe("proxy gates the wishlist", () => {
  const proxy = readSource("src/proxy.ts");

  it("matches /wishlist and bounces guests to login with a callback", () => {
    // Phase 17: the matcher is catch-all (except Auth.js's own endpoints)
    // so security headers apply to every response; the wishlist gate itself
    // keys off the path prefixes below.
    expect(proxy).toContain('matcher: ["/((?!api/auth/).*)"]');
    expect(proxy).toMatch(/isAccountRoute \|\| isWishlistRoute/);
    expect(proxy).toMatch(/pathname\.startsWith\("\/wishlist"\)/);
    // ...and the header pipeline exists for all of them.
    expect(proxy).toContain("Content-Security-Policy");
    expect(proxy).toContain("X-Content-Type-Options");
  });
});

describe("card and panel wiring", () => {
  const card = readSource("src/components/storefront/ProductCard.tsx");

  it("renders the heart outside the card link", () => {
    expect(card).toContain("<WishlistButton");
    expect(card).toContain("wishlisted={wishlisted}");
    // A <button> inside <Link> would navigate instead of toggling.
    expect(card.indexOf("</Link>")).toBeLessThan(card.indexOf("<WishlistButton"));
    expect(card.indexOf('href={`/product/${product.slug}`}')).toBeLessThan(
      card.indexOf("<WishlistButton")
    );
  });

  it("keeps the rating guard the reviews suite depends on", () => {
    expect(card).toMatch(/product\.ratingCount > 0/);
    expect(card).toMatch(/aria-label=\{`Rated/);
  });

  it("the product panel carries a large heart beside the title", () => {
    const panel = readSource("src/components/storefront/PurchasePanel.tsx");
    expect(panel).toContain("<WishlistButton");
    expect(panel).toContain('size="lg"');
    expect(panel).toContain("wishlisted={wishlisted}");
    expect(panel).toContain("WishlistButton productId={product.id}");
  });
});

describe("header and menu search retarget", () => {
  it("header posts to /search and links the wishlist when signed in", () => {
    const header = readSource("src/components/shared/Header.tsx");
    expect(header).toMatch(/<form method="GET" action="\/search"/);
    expect(header).not.toMatch(/<form method="GET" action="\/shop"/);
    expect(header).toContain('href: "/wishlist"');
    expect(header).toContain('label: "Wishlist"');
  });

  it("mobile menu posts to /search too", () => {
    const menu = readSource("src/components/shared/MobileMenu.tsx");
    expect(menu).toMatch(/<form method="GET" action="\/search"/);
  });

  it("SortSelect keeps /shop as its default and takes a basePath", () => {
    const sort = readSource("src/components/storefront/SortSelect.tsx");
    expect(sort).toContain('basePath = "/shop"');
    expect(sort).toContain("router.push(`${basePath}?");
    expect(sort).not.toContain("router.push(`/shop?");
  });
});

describe("pages", () => {
  it("/search renders the results heading, count and grid via getProducts", () => {
    const source = readSource("src/app/(storefront)/search/page.tsx");
    expect(source).toContain("Results for");
    expect(source).toContain("matching");
    expect(source).toContain("getProducts(");
    expect(source).toContain('basePath="/search"');
    expect(source).toMatch(/<form method="GET" action="\/search"/);
    expect(source).toContain("No matches");
    expect(source).toContain("wishlisted={wished.has(product.id)}");
    // Never a raw query — search flows through sanitizeFilters.
    expect(source).not.toContain('@/lib/db');
    expect(source).not.toContain("db.product.findMany");
  });

  it("/shop keeps its inline /shop search and full filters", () => {
    const source = readSource("src/app/(storefront)/shop/page.tsx");
    expect(source).toMatch(/<form method="GET" action="\/shop"/);
    expect(source).toContain("CategoryTabs");
    expect(source).toContain("ShopFilters");
    expect(source).toContain("wishlisted={wished.has(product.id)}");
  });

  it("/wishlist is auth-first, redirects guests and marks its cards", () => {
    const source = readSource("src/app/(storefront)/wishlist/page.tsx");
    expect(source).toContain('redirect("/login?callbackUrl=/wishlist")');
    expect(source).toContain("getWishlistProducts()");
    expect(source).toContain("No saved items yet");
    expect(source).toContain("wishlisted />");
    expect(source).toMatch(/<ProductCard/);
  });

  it("every ProductCard page passes heart state", () => {
    const home = readSource("src/app/(storefront)/page.tsx");
    expect(home).toContain("getWishlistProductIds");
    expect(home).toContain("wishlisted={wished.has(product.id)}");
    const detail = readSource("src/app/(storefront)/product/[slug]/page.tsx");
    expect(detail).toContain("getWishlistProductIds");
    expect(detail).toContain("wishlisted={wished.has(product.id)}");
    expect(detail).toContain("wishlisted={wished.has(item.id)}");
  });
});

describe("catalog mapper stays shared", () => {
  const queries = readSource("src/modules/catalog/queries.ts");

  it("one mapper, exported for the wishlist", () => {
    expect(queries).toContain("export function toProductListItem");
    expect(queries).toContain("export const CARD_PRODUCT_INCLUDE");
    expect(queries).toContain("products.map(toProductListItem)");
    // Exactly ONE mapping implementation — the old inline block must not
    // survive alongside the extracted function.
    expect((queries.match(/approvedRatings\.reduce/g) ?? [])).toHaveLength(1);
    expect((queries.match(/products\.map\(/g) ?? [])).toHaveLength(1);
  });

  it("the catalog barrel exports the mapper for other modules", () => {
    const barrel = readSource("src/modules/catalog/index.ts");
    expect(barrel).toContain("toProductListItem");
    expect(barrel).toContain("CARD_PRODUCT_INCLUDE");
  });
});
