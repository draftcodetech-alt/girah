import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 16 (design & polish): applied design per the initial design spec —
// floral assets, motion tokens, homepage sections, header/footer, product
// accordions + mini-cart drawer, spec copy, structured data.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(join(ROOT, relativePath));
}

describe("Phase 16: floral assets (rembg cutouts)", () => {
  it("ships every transparent cutout the homepage references", () => {
    for (const name of [
      "sunflower.png",
      "sunflower-02.png",
      "sunflower-03.png",
      "lily.png",
      "duck.png",
      "duck-01.png",
    ]) {
      expect(exists(`public/florals/${name}`)).toBe(true);
    }
  });

  it("has a reproducible generation script", () => {
    expect(exists("scripts/cutouts.py")).toBe(true);
    const script = readSource("scripts/cutouts.py");
    expect(script).toMatch(/rembg/);
    expect(script).toMatch(/public.*florals/);
  });

  it("never references a floral file it does not ship", () => {
    const shipped = new Set(readdirSync(join(ROOT, "public/florals")));
    const pages = [
      "src/components/storefront/home/Hero.tsx",
      "src/components/storefront/home/GalleryCollage.tsx",
    ];
    for (const page of pages) {
      const source = readSource(page);
      for (const match of source.matchAll(/src="\/florals\/([^"]+)"/g)) {
        expect(shipped.has(match[1])).toBe(true);
      }
    }
  });
});

describe("Phase 16: motion & a11y tokens", () => {
  const css = readSource("src/app/globals.css");

  it("defines the design-spec motion durations", () => {
    expect(css).toMatch(/--dur-fast: 150ms/);
    expect(css).toMatch(/--dur-standard: 250ms/);
    expect(css).toMatch(/--dur-comfort: 400ms/);
    expect(css).toMatch(/--dur-editorial: 700ms/);
  });

  it("defines the spacing scale and global dimensions", () => {
    expect(css).toMatch(/--space-1: 4px/);
    expect(css).toMatch(/--space-12: 120px/);
    expect(css).toMatch(/--container-max: 1280px/);
    expect(css).toMatch(/--header-h-desktop: 80px/);
    expect(css).toMatch(/--header-h-mobile: 64px/);
  });

  it("kills animation under prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation-duration: 0\.01ms !important/);
  });

  it("keeps a global visible focus ring", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline: 2px solid var\(--color-sage\)/);
  });

  it("uses the AA-passing muted color (spec #6F786F measured 4.30:1)", () => {
    expect(css).toMatch(/--color-muted: #656E65/);
    expect(css).not.toMatch(/--color-muted: #6F786F/);
  });
});

describe("Phase 16: homepage sections", () => {
  const home = readSource("src/app/(storefront)/page.tsx");
  const hero = readSource("src/components/storefront/home/Hero.tsx");
  const gallery = readSource("src/components/storefront/home/GalleryCollage.tsx");
  const collections = readSource("src/components/storefront/home/CollectionSections.tsx");
  const closing = readSource("src/components/storefront/home/ClosingCta.tsx");
  const instagram = readSource("src/components/storefront/home/InstagramShowcase.tsx");

  it("hero carries the locked copy and a single CTA", () => {
    // Headline ships as two spans (mockup line break) — assert both halves.
    expect(hero).toContain("Handmade Pieces,");
    expect(hero).toContain("Made to Be Cherished.");
    expect(hero).toContain("From lasting blooms to little keepsakes, every piece is made with care.");
    expect(hero).toContain("Shop Handmade");
    expect(hero).not.toContain("What's new");
    expect(hero.match(/<ButtonLink/g) ?? []).toHaveLength(1);
    expect(hero).toMatch(/min-h-\[80vh\]/);
    expect(hero).toContain("HANDMADE WITH LOVE");
    expect(hero).toContain("rounded-full");
    expect(hero).not.toContain("florals/lily");
    expect(hero).toContain("Girah");
  });

  it("ships the gallery collage (replaces the magazine grid)", () => {
    expect(gallery).toMatch(/^"use client"/);
    expect(gallery).toContain("A little world,");
    expect(gallery).toContain("Every stitch tells a story");
    expect(gallery).toContain("Explore the collection");
    expect(gallery).toContain('href="/shop"');
    expect(gallery).toContain('aria-labelledby="gg-heading"');
    // Reveals + parallax are JS-driven; reduced-motion/no-JS must still show it.
    expect(gallery).toContain("prefers-reduced-motion");
    expect(home).toMatch(/<Hero \/>\s*<GalleryCollage \/>/);
    expect(home).not.toContain("MagazineGrid");
    expect(exists("src/components/storefront/home/MagazineGrid.tsx")).toBe(false);
    // Gallery images ship in public/ (vines converted from the 4.3MB PNGs).
    for (const name of ["sunflower.webp", "vine1.webp", "vine2.webp"]) {
      expect(exists(`public/gallery/${name}`)).toBe(true);
    }
  });

  it("keeps wishlist plumbing and category chips off the homepage", () => {
    expect(home).toContain("getWishlistProductIds");
    // The featured trio ("FIND SOMETHING TO CHERISH") was removed by request.
    expect(home).not.toContain("FIND SOMETHING TO CHERISH");
    expect(home).not.toContain("home-featured");
    // Category chips moved to /shop — the design homepage has no such section.
    expect(home).not.toContain("home-categories");
  });

  it("keeps the trust strip quiet on cream", () => {
    expect(home).toContain("Why shop with Girah");
    expect(home).toMatch(/bg-cream pb-16[\s\S]*home-trust/);
  });

  it("ships the curated collections around the untouched product card", () => {
    // section copy + CTAs from the homepage brief
    expect(collections).toContain("JUST OFF THE HOOK");
    expect(collections).toContain("FLOWERS THAT STAY");
    expect(collections).toContain("MADE TO MAKE SOMEONE SMILE");
    expect(collections).toContain('href="/shop?sort=newest"');
    expect(collections).toContain('href="/shop?category=home-decor"');
    expect(collections).toContain('href="/shop?category=keychains"');
    // one card implementation only — reuses ProductCard, never a local card
    expect(collections).toContain('from "@/components/storefront/ProductCard"');
    expect(collections).not.toContain("function ProductCard");
    // page order: gallery → collections → brand story; bouquet gone
    expect(home).toMatch(/<GalleryCollage \/>\s*<CollectionSections/);
    expect(home).toContain("<CollectionSections");
    expect(home).toMatch(/<CollectionSections[\s\S]*home-trust/);
    expect(home).not.toContain("ImmersiveBouquet");
    // pools are deduped against cards already shown above; 3 cards per section
    expect(home).toContain("const shown = new Set(");
    expect(home).toMatch(/slice\(0, 3\)/);
  });

  it("closing CTA matches the spec and the sage band is gone", () => {
    expect(closing).toContain("A SMALL GIRAH MOMENT");
    expect(closing).toContain("Handmade things,");
    expect(closing).toContain("made to stay.");
    expect(home).not.toMatch(/bg-sage text-cream">\s*<div[^>]*>[\s\S]*Made to be cherished/);
  });

  it("Instagram showcase is fully gated on real assets", () => {
    expect(instagram).toMatch(/NEXT_PUBLIC_INSTAGRAM_URL/);
    expect(instagram).toMatch(/return null/);
    expect(instagram).toContain("public");
    expect(instagram).toContain("instagram");
  });

  it("loads structured data (WebSite + Organization)", () => {
    expect(home).toContain("application/ld+json");
    expect(home).toContain('"@type": "WebSite"');
    expect(home).toContain('"@type": "Organization"');
  });
});

describe("Phase 16: header, menu, footer", () => {
  const header = readSource("src/components/shared/Header.tsx");
  const menu = readSource("src/components/shared/MobileMenu.tsx");
  const footer = readSource("src/components/shared/Footer.tsx");

  it("header is 80/64 with Home in the nav and keeps search + cart", () => {
    expect(header).toMatch(/h-16 md:h-20/);
    expect(header).toContain('label: "Home"');
    expect(header).toContain('<form method="GET" action="/search"');
    expect(header).toContain("CartBadge");
  });

  it("mobile menu is a full-screen overlay dialog", () => {
    expect(menu).toMatch(/fixed inset-0 z-50 bg-cream/);
    expect(menu).toContain('role="dialog"');
    expect(menu).toContain('aria-modal="true"');
    expect(menu).toContain("Escape");
    expect(menu).toContain("hidden"); // scroll lock
  });

  it("footer is cream with the brand sentence and gated social links", () => {
    expect(footer).toMatch(/bg-cream\b/);
    expect(footer).not.toMatch(/bg-sage-light\/60/);
    expect(footer).toContain("Handmade pieces, made to be cherished.");
    expect(footer).toContain("NEXT_PUBLIC_INSTAGRAM_URL");
    expect(footer).toContain("NEXT_PUBLIC_WHATSAPP_URL");
    expect(footer).toContain("© {year} Girah");
  });

  it("links only content routes that exist", () => {
    // FAQ has no page — never linked.
    expect(footer).not.toContain('href: "/faq"');
    // Phase 17 shipped these six as real routes, all linked from the footer
    // (INFO_LINKS uses object-literal `href: "/…"` syntax).
    for (const route of ["/about", "/contact", "/shipping", "/returns", "/privacy", "/terms"]) {
      expect(footer).toContain(`href: "${route}"`);
    }
  });
});

describe("Phase 16: product page interactions", () => {
  const panel = readSource("src/components/storefront/PurchasePanel.tsx");
  const accordion = readSource("src/components/storefront/Accordion.tsx");
  const drawer = readSource("src/components/storefront/MiniCartDrawer.tsx");

  it("renders the two data-safe accordions with real semantics", () => {
    expect(panel).toContain('title="Description"');
    expect(panel).toContain('title="Details"');
    // Shipping/Care copy must not be invented — only these two ship now.
    expect(panel).not.toContain('title="Shipping"');
    expect(panel).not.toContain('title="Care Instructions"');
    expect(accordion).toContain('aria-expanded={open}');
    expect(accordion).toContain("aria-controls");
  });

  it("shows the free-shipping estimate near the buy action", () => {
    expect(panel).toContain("Free shipping on all orders.");
  });

  it("opens the mini-cart drawer on success instead of navigating", () => {
    expect(panel).toContain("<MiniCartDrawer");
    expect(panel).toContain("setDrawerOpen(true)");
    expect(panel).not.toMatch(/Added .* to your cart\."\s*\}\)/);
  });

  it("drawer is an accessible dialog with both spec actions", () => {
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('aria-modal="true"');
    expect(drawer).toContain("View Cart");
    expect(drawer).toContain("Continue Shopping");
    expect(drawer).toContain('role="status"');
    expect(drawer).toContain("Escape");
  });

  it("variation buttons expose selected state and the panel has a mobile sticky ATC", () => {
    expect(panel).toContain("aria-pressed={isSelected}");
    expect(panel).toContain("atcOutOfView");
    expect(panel).toMatch(/lg:hidden/);
  });

  it("buttons carry the spec uppercase treatment", () => {
    const button = readSource("src/components/ui/Button.tsx");
    expect(button).toMatch(/uppercase tracking-\[0\.02em\]/);
  });
});

describe("Phase 16: spec copy passes", () => {
  it("shop intro + empty states match the spec", () => {
    const shop = readSource("src/app/(storefront)/shop/page.tsx");
    expect(shop).toContain("Discover handmade pieces, made with care.");
    expect(shop).toContain('"No matches"');
    expect(shop).toContain('"Nothing here"');
    expect(shop).toContain("Try adjusting your filters to find a piece.");
    expect(shop).toContain("Clear Search");
    expect(shop).toContain("application/ld+json");
    expect(shop).toContain("BreadcrumbList");
  });

  it("search page empty state reuses the spec pattern", () => {
    const search = readSource("src/app/(storefront)/search/page.tsx");
    expect(search).toContain("No matches");
    expect(search).toContain("Clear Search");
  });

  it("cart empty state and CTA match the spec", () => {
    const cart = readSource("src/app/(storefront)/cart/page.tsx");
    expect(cart).toContain("Your cart is empty.");
    expect(cart).toContain("Find something handmade to cherish.");
    expect(cart).toContain("Proceed to Checkout");
    expect(cart).toMatch(/text-\[20px\]/); // Total at spec 20/600
  });

  it("login and register headings render uppercase per spec", () => {
    const login = readSource("src/components/storefront/LoginForm.tsx");
    const register = readSource("src/components/storefront/RegisterForm.tsx");
    expect(login).toMatch(/text-h1 text-charcoal text-center uppercase/);
    expect(login).toContain("Continue as Guest");
    expect(register).toMatch(/text-h1 text-charcoal text-center uppercase/);
    expect(register).not.toContain("address"); // no address fields on register
  });

  it("account dashboard has the editorial blocks + wishlist superset", () => {
    const account = readSource("src/app/account/page.tsx");
    expect(account).toContain('href="/account/orders"');
    expect(account).toContain('href="/account/profile"');
    expect(account).toContain('href="/account/addresses"');
    expect(account).toContain('href="/wishlist"');
    expect(account).toContain("Saved Shipping");
    expect(account).toMatch(/text-h1 text-charcoal uppercase/);
    expect(account).toMatch(/Log Out/);
  });

  it("confirmation states Total prefix and a thin sage glyph", () => {
    const confirmation = readSource("src/app/(storefront)/order/[id]/confirmation/page.tsx");
    expect(confirmation).toContain("Total:");
    expect(confirmation).toMatch(/text-\[36px\][^>]*text-sage/);
    expect(confirmation).toContain("Continue Shopping");
  });

  it("product page ships Product JSON-LD with rating + offer", () => {
    const product = readSource("src/app/(storefront)/product/[slug]/page.tsx");
    expect(product).toContain("application/ld+json");
    expect(product).toContain("aggregateRating");
    expect(product).toContain("priceCurrency");
    expect(product).toContain('"@type": "Product"');
  });
});
