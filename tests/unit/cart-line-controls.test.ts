import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Phase 8: the cart steppers used to be inline server-component closures whose
// CartActionResult was awaited and discarded — a refused change (stock moved,
// line disabled) left the quantity unchanged with no message. The controls are
// now a client component that surfaces the refusal.

const CONTROLS = "src/components/storefront/CartLineControls.tsx";
const PAGE = "src/app/(storefront)/cart/page.tsx";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("CartLineControls surfaces refused cart updates", () => {
  it("is a client component driven by useActionState", () => {
    const source = readSource(CONTROLS);
    expect(source).toMatch(/^"use client";/);
    expect(source).toMatch(/useActionState</);
  });

  it("renders the server refusal with role=\"alert\"", () => {
    expect(readSource(CONTROLS)).toMatch(/role="alert"/);
  });

  it("routes all three operations through the shared cart actions", () => {
    const source = readSource(CONTROLS);
    expect(source).toMatch(/updateCartItemQuantity\(/);
    expect(source).toMatch(/removeCartItem\(/);
    expect(source).toMatch(/name="op"/);
  });

  it("keeps the DOM contract the E2E suite asserts on", () => {
    const source = readSource(CONTROLS);
    expect(source).toMatch(/aria-label="Decrease quantity"/);
    expect(source).toMatch(/aria-label="Increase quantity"/);
    expect(source).toMatch(/aria-label=\{`Remove \$\{productName\}`\}/);
    // Same stock/enabled disable rules as before (E2E checks the disabled attr).
    expect(source).toMatch(/quantity >= availableStock \|\| !isEnabled \|\| availableStock <= 0/);
    expect(source).toMatch(/quantity <= 1 \|\| !isEnabled \|\| availableStock <= 0/);
  });
});

describe("cart page no longer discards the result", () => {
  it("renders CartLineControls instead of inline server closures", () => {
    const source = readSource(PAGE);
    expect(source).toMatch(/<CartLineControls\b/);
    expect(source).not.toMatch(/"use server"/);
  });

  it("does not call the cart actions itself (the component owns the result)", () => {
    const source = readSource(PAGE);
    expect(source).not.toMatch(/updateCartItemQuantity\(/);
    expect(source).not.toMatch(/removeCartItem\(/);
  });
});
