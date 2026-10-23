import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Owner spec change (2026-10-23): nobody buys anonymously. Browsing stays
// open — a guest can read /, /shop and every /product page — but the three
// ways INTO buying (add to cart, the cart, checkout) are session-only, at
// both the edge (proxy) and the layer that actually mutates (the actions).
// Selling was already closed: /admin is ADMIN-only and public signup only
// ever creates CUSTOMER accounts, so this file has nothing to add there.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("proxy bounces guests off cart and checkout", () => {
  const proxy = readSource("src/proxy.ts");

  it("names both routes as gates", () => {
    expect(proxy).toContain('pathname.startsWith("/cart")');
    expect(proxy).toContain('pathname.startsWith("/checkout")');
  });

  it("requires a session for them, through the same header-preserving respond()", () => {
    expect(proxy).toMatch(/isCartRoute \|\| isCheckoutRoute/);
    expect(proxy).toMatch(/return respond\(loginUrl\(\)\)/);
  });
});

describe("cart actions refuse signed-out callers", () => {
  const actions = readSource("src/modules/cart/actions.ts");

  it("addToCart checks the session before any cart work", () => {
    // The refusal must come BEFORE identity resolution, otherwise a guest
    // cookie is minted on the way to being refused.
    const sessionAt = actions.indexOf("const session = await auth()");
    const identityAt = actions.indexOf("resolveCartIdentity(");
    expect(sessionAt).toBeGreaterThan(-1);
    expect(identityAt).toBeGreaterThan(sessionAt);
    expect(actions).toContain('"You must be signed in."');
  });
});

describe("checkout refuses signed-out callers", () => {
  const action = readSource("src/modules/checkout/actions.ts");

  it("placeOrder resolves the session before the Safepay gate and the core", () => {
    const sessionAt = action.indexOf("const session = await auth()");
    const safepayAt = action.indexOf("isSafepayConfigured()");
    const coreAt = action.indexOf("placeOrderCore(");
    expect(sessionAt).toBeGreaterThan(-1);
    expect(safepayAt).toBeGreaterThan(sessionAt);
    expect(coreAt).toBeGreaterThan(sessionAt);
    expect(action).toContain('"You must be signed in."');
  });
});

describe("product page routes guests to sign in instead of adding", () => {
  const panel = readSource("src/components/storefront/PurchasePanel.tsx");
  const columns = readSource("src/components/storefront/ProductDetailColumns.tsx");
  const page = readSource("src/app/(storefront)/product/[slug]/page.tsx");

  it("the panel takes an isLoggedIn flag and redirects on Add to Cart", () => {
    expect(panel).toContain("isLoggedIn");
    expect(panel).toContain("router.push(`/login?callbackUrl=/product/${product.slug}`)");
  });

  it("both buy buttons say the same thing to a guest", () => {
    const labels = panel.match(/"Sign in to Buy"/g) ?? [];
    expect(labels.length).toBe(2); // desktop panel + mobile sticky bar
  });

  it("the flag is threaded from the server session, not guessed client-side", () => {
    expect(columns).toContain("isLoggedIn={isLoggedIn}");
    expect(page).toContain("isLoggedIn={Boolean(session?.user)}");
  });
});
