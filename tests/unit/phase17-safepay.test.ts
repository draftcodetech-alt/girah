import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17: Safepay is opt-in. One env switch (SAFEPAY_ENV) points the whole
// integration at sandbox/live, and everything fails CLOSED when the merchant
// credentials are missing — the checkout radio hides, the server refuses.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Phase 17: SAFEPAY_ENV switch", () => {
  const safepay = readSource("src/modules/payments/safepay.ts");

  it("derives host + checkout env from one switch, sandbox by default", () => {
    expect(safepay).toContain('process.env.SAFEPAY_ENV === "live"');
    expect(safepay).toContain('"https://sandbox.api.getsafepay.com"');
    expect(safepay).toContain('"https://api.getsafepay.com"');
    expect(safepay).not.toContain("TODO: switch");
  });

  it("maps live → the hosted checkout's \"production\" vocabulary", () => {
    expect(safepay).toContain('SAFEPAY_ENV === "live" ? "production" : "sandbox"');
  });

  it("exposes isSafepayConfigured (credentials present)", () => {
    expect(safepay).toContain("export function isSafepayConfigured");
    expect(safepay).toContain("SAFEPAY_API_KEY");
    expect(safepay).toContain("SAFEPAY_API_SECRET");
  });

  it("initialises the client lazily so importing never throws unconfigured", () => {
    expect(safepay).toContain("function getSafepayClient");
    // No module-scope `new Safepay(` — only inside the lazy accessor.
    expect(safepay).not.toMatch(/^const safepay = new Safepay/m);
    expect(safepay).toMatch(/safepay \?\?= new Safepay\(/);
  });
});

describe("Phase 17: checkout hides online payment when unconfigured", () => {
  const form = readSource("src/components/storefront/CheckoutForm.tsx");
  const page = readSource("src/app/(storefront)/checkout/page.tsx");
  const action = readSource("src/modules/checkout/actions.ts");

  it("the form only renders the Safepay radio behind safepayEnabled", () => {
    expect(form).toContain("safepayEnabled");
    expect(form).toMatch(/\{safepayEnabled && \(/);
    // The radio block must live inside that guard.
    const guardAt = form.indexOf("{safepayEnabled && (");
    const radioAt = form.indexOf('value="SAFEPAY"');
    expect(guardAt).toBeGreaterThan(-1);
    expect(radioAt).toBeGreaterThan(guardAt);
  });

  it("the server page passes the configured flag through", () => {
    expect(page).toContain("isSafepayConfigured()");
    expect(page).toContain("safepayEnabled=");
  });

  it("placeOrder refuses SAFEPAY server-side before creating any order", () => {
    expect(action).toContain('data.paymentMethod === "SAFEPAY" && !isSafepayConfigured()');
    // The guard must sit before the order row is created.
    expect(action.indexOf("!isSafepayConfigured()")).toBeLessThan(
      action.indexOf("placeOrderCore(")
    );
  });

  it("the retry path funnels through the same lazy client", () => {
    const orders = readSource("src/modules/orders/actions.ts");
    expect(orders).toContain("createSafepayCheckoutUrl");
  });
});

describe("Phase 17: .env.example documents the switch", () => {
  it("ships SAFEPAY_ENV alongside the credentials", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).toContain('SAFEPAY_ENV=""');
  });
});
