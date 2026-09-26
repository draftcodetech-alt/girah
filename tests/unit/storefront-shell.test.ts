import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 9 (storefront shell): homepage rewrite, Header search + mobile menu,
// Footer scoping, breadcrumbs, shared UI primitives.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(join(ROOT, relativePath));
}

const HEADER_LAYOUTS = [
  "src/app/(storefront)/layout.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/account/layout.tsx",
];

describe("Phase 9: homepage", () => {
  const source = readSource("src/app/(storefront)/page.tsx");

  it("is the real, data-driven homepage", () => {
    expect(source).toMatch(/getProducts/);
    expect(source).toMatch(/getCategories/);
    expect(source).toMatch(/ProductCard/);
  });

  it("create-next-app boilerplate is gone", () => {
    expect(source).not.toMatch(/create-next-app/);
    expect(source).not.toMatch(/Deploy Now/);
    expect(source).not.toMatch(/next\.svg|vercel\.svg/);
  });

  it("boilerplate svgs are deleted from public/", () => {
    for (const svg of ["next.svg", "vercel.svg", "file.svg", "globe.svg", "window.svg"]) {
      expect(exists(`public/${svg}`)).toBe(false);
    }
  });
});

describe("Phase 9: Header", () => {
  const source = readSource("src/components/shared/Header.tsx");

  it("is no longer the minimal scaffold", () => {
    expect(source).not.toMatch(/MINIMAL SCAFFOLD/);
  });

  it("ships a GET search form to /shop", () => {
    expect(source).toMatch(/<form method="GET" action="\/shop"/);
    expect(source).toMatch(/name="search"/);
  });

  it("keeps the cart badge and mounts the mobile menu", () => {
    expect(source).toMatch(/<CartBadge\s*\/>/);
    expect(source).toMatch(/<MobileMenu/);
  });

  it("mobile menu is a client component with proper aria wiring", () => {
    const menu = readSource("src/components/shared/MobileMenu.tsx");
    expect(menu).toMatch(/^"use client"/);
    expect(menu).toMatch(/aria-expanded/);
    expect(menu).toMatch(/aria-controls="mobile-menu"/);
    expect(menu).toMatch(/<form method="GET" action="\/shop"/);
  });
});

describe("Phase 9: Footer", () => {
  const footer = readSource("src/components/shared/Footer.tsx");

  it.each(HEADER_LAYOUTS)("%s renders the Footer", (relativePath) => {
    expect(readSource(relativePath)).toMatch(/<Footer\s*\/>/);
    expect(readSource(relativePath)).toMatch(/<main className="flex-1">/);
  });

  it("admin ships no storefront Footer", () => {
    expect(readSource("src/app/admin/layout.tsx")).not.toMatch(/<Footer\s*\/>/);
  });

  it("only links to routes that exist (no dead links)", () => {
    const allowed = new Set([
      "/",
      "/shop",
      "/cart",
      "/checkout",
      "/login",
      "/register",
      "/account",
      "/account/orders",
      "/account/profile",
    ]);
    const literalHrefs = [
      ...[...footer.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), // JSX href="…"
      ...[...footer.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]), // link const arrays
    ];
    expect(literalHrefs.length).toBeGreaterThan(0);
    for (const href of literalHrefs) {
      expect(allowed.has(href), `dead footer link: ${href}`).toBe(true);
    }
    // Dynamic category links go through the shop filter, never a missing route.
    expect(footer).toMatch(/href=\{`\/shop\?category=/);
  });
});

describe("Phase 9: breadcrumbs", () => {
  const source = readSource("src/components/shared/Breadcrumbs.tsx");

  it("is accessible (nav landmark + aria-current on the last crumb)", () => {
    expect(source).toMatch(/aria-label="Breadcrumb"/);
    expect(source).toMatch(/aria-current=\{last \? "page" : undefined\}/);
  });

  it.each([
    "src/app/(storefront)/shop/page.tsx",
    "src/app/(storefront)/product/[slug]/page.tsx",
    "src/app/account/page.tsx",
    "src/app/account/orders/page.tsx",
    "src/app/account/orders/[id]/page.tsx",
    "src/app/account/profile/page.tsx",
  ])("%s renders Breadcrumbs", (relativePath) => {
    expect(readSource(relativePath)).toMatch(/<Breadcrumbs/);
  });
});

describe("Phase 9: UI primitives", () => {
  it.each(["Button", "ButtonLink", "Input", "Field"])("%s exists", (name) => {
    expect(exists(`src/components/ui/${name}.tsx`)).toBe(true);
  });

  it("Button uses design tokens", () => {
    const source = readSource("src/components/ui/Button.tsx");
    expect(source).toMatch(/--radius-control/);
    expect(source).toMatch(/bg-sage/);
  });

  it("Input uses design tokens", () => {
    const source = readSource("src/components/ui/Input.tsx");
    expect(source).toMatch(/--radius-control/);
    expect(source).toMatch(/border-border/);
    // React's numeric `size` attribute must be omitted, not intersected.
    expect(source).toMatch(/Omit<InputHTMLAttributes<HTMLInputElement>, "size">/);
  });

  it("Field renders failures with the repo's role=alert convention", () => {
    const source = readSource("src/components/ui/Field.tsx");
    expect(source).toMatch(/role="alert"/);
    expect(source).toMatch(/text-error/);
  });
});
