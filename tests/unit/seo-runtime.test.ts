import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import robots from "@/app/robots";

// Phase B: SEO runtime behavior (robots executes — type-only import, no I/O)
// plus source guards where a database stands behind the function.
const ROOT = process.cwd();
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("seo runtime", () => {
  it("robots blocks private surfaces and allows the storefront", async () => {
    const rules = (await robots()) as { rules: { disallow?: string | string[] }[] };
    const disallow: string[] = rules.rules.flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []
    );
    for (const blocked of ["/admin/", "/account/", "/checkout", "/api/"]) {
      expect(disallow.some((d) => d.includes(blocked))).toBe(true);
    }
  });

  it("sitemap lists products and content but never search", () => {
    const source = readSource("src/app/sitemap.ts");
    expect(source).toContain("/shop");
    expect(source).toContain("db.product");
    expect(source).not.toContain("/search");
  });
});

describe("proxy boot guard wiring", () => {
  it("proxy invokes assertProdConfig on every request path", () => {
    const source = readSource("src/proxy.ts");
    expect(source).toContain('import { assertProdConfig } from "@/lib/config-guard"');
    expect(source).toMatch(/assertProdConfig\(\);/);
  });

  it("admin/account/wishlist bounces preserve the callback URL", () => {
    const source = readSource("src/proxy.ts");
    expect(source).toContain("callbackUrl");
    expect(source).toContain("/admin");
    expect(source).toContain("/wishlist");
  });

  it("pins images to the single remote host and locks private paths out of shared cache", () => {
    const source = readSource("src/proxy.ts");
    expect(source).toContain("img-src 'self' data: blob: https://res.cloudinary.com");
    expect(source).not.toMatch(/img-src[^;\n]*https:(?!\/\/res\.cloudinary\.com)/);
    expect(source).toContain('Cache-Control", "private, no-store"');
    for (const prefix of ["/account", "/order/", "/wishlist"]) {
      expect(source).toContain(`pathname.startsWith("${prefix}")`);
    }
  });

  it("login throttle prefers the proxy-authoritative client IP", () => {
    const source = readSource("src/lib/auth.ts");
    const cf = source.indexOf("cf-connecting-ip");
    const xff = source.indexOf("x-forwarded-for");
    expect(cf).toBeGreaterThanOrEqual(0);
    expect(xff).toBeGreaterThanOrEqual(0);
    expect(cf).toBeLessThan(xff);
  });

  it("reset-token guessing is throttled outside test runs", () => {
    const source = readSource("src/modules/accounts/actions.ts");
    expect(source).toContain("pwreset-verify:");
    expect(source).toContain('process.env.NODE_ENV !== "test"');
  });

  it("per-order pages stay out of the index", () => {
    for (const page of [
      "src/app/account/orders/[id]/receipt/page.tsx",
      "src/app/(storefront)/order/[id]/confirmation/page.tsx",
    ]) {
      expect(readSource(page)).toContain("index: false");
    }
  });
});
