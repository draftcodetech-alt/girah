import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { savedShippingSchema } from "@/modules/addresses";
import { checkoutSchema } from "@/modules/checkout/schema";

// Phase 12 (account completion): schema composition and the source-level
// shell wiring (nav, prefill, receipt). Customer cancel / buy-again / print
// were removed as spec changes (see delaytest.md) — this file now locks
// that they STAY removed, plus the "Review now" plumbing on delivered orders.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), "utf8");

describe("Phase 12: saved shipping schema", () => {
  const valid = {
    fullName: "Ayesha Khan",
    phone: "03001234567",
    address: "House 12, Street 4",
    city: "Lahore",
    postalCode: "54000",
  };

  it("accepts a complete address", () => {
    expect(savedShippingSchema.safeParse(valid).success).toBe(true);
  });

  it("treats an empty postal code as absent, not an error", () => {
    expect(savedShippingSchema.safeParse({ ...valid, postalCode: "" }).success).toBe(true);
    expect(savedShippingSchema.safeParse({ ...valid, postalCode: undefined }).success).toBe(true);
  });

  it.each(["fullName", "phone", "address", "city"] as const)("requires %s", (field) => {
    const result = savedShippingSchema.safeParse({ ...valid, [field]: "   " });
    expect(result.success).toBe(false);
  });

  it("caps over-long fields instead of storing them", () => {
    expect(savedShippingSchema.safeParse({ ...valid, address: "x".repeat(501) }).success).toBe(false);
    expect(savedShippingSchema.safeParse({ ...valid, postalCode: "x".repeat(21) }).success).toBe(false);
  });
});

describe("Phase 12: checkout schema composition", () => {
  const checkout = {
    fullName: "Ayesha Khan",
    phone: "03001234567",
    email: "ayesha@example.com",
    address: "House 12, Street 4",
    city: "Lahore",
    postalCode: "",
    deliveryNotes: "",
    paymentMethod: "COD" as const,
  };

  it("keeps the shared shipping rules (same messages as the address form)", () => {
    const result = checkoutSchema.safeParse({ ...checkout, city: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("City is required");
    }
  });

  it("makes saveAddress optional so existing callers stay valid", () => {
    expect(checkoutSchema.safeParse(checkout).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...checkout, saveAddress: true }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...checkout, saveAddress: false }).success).toBe(true);
  });

  it("still validates paymentMethod", () => {
    expect(checkoutSchema.safeParse({ ...checkout, paymentMethod: "BITCOIN" }).success).toBe(false);
  });
});

describe("Phase 12: account shell wiring", () => {
  const nav = readSource("src/components/storefront/AccountNav.tsx");

  it("marks the active section with aria-current, never role=tab", () => {
    expect(nav).toMatch(/^"use client"/);
    expect(nav).toMatch(/aria-current=\{isCurrent \? "page" : undefined\}/);
    expect(nav).not.toMatch(/role="tab"/);
  });

  it("prefix-matches children but never a sibling prefix", () => {
    expect(nav).toMatch(/pathname === tab\.href/);
    expect(nav).toMatch(/pathname\.startsWith\(`\$\{tab\.href\}\/`\)/);
  });

  it("is mounted once by the shared account layout, so every section page inherits it", () => {
    const layout = readSource("src/app/account/layout.tsx");
    expect(layout).toMatch(/<AccountNav\s*\/>/);
  });

  it("footer gains the shipping-address link", () => {
    const footer = readSource("src/components/shared/Footer.tsx");
    expect(footer).toMatch(/href: "\/account\/addresses"/);
  });
});

describe("Phase 12: checkout prefill + save", () => {
  const page = readSource("src/app/(storefront)/checkout/page.tsx");
  const form = readSource("src/components/storefront/CheckoutForm.tsx");

  it("the checkout page loads profile + saved address and passes them down", () => {
    expect(page).toMatch(/getCurrentUserProfile/);
    expect(page).toMatch(/getMyShippingAddress/);
    expect(page).toMatch(/savedAddress=\{savedAddress\}/);
    expect(page).toMatch(/showSaveOption=\{Boolean\(profile\)\}/);
  });

  it("prefills every shipping field and the profile email", () => {
    expect(form).toMatch(/defaultValue=\{savedAddress\?\.fullName/);
    expect(form).toMatch(/defaultValue=\{savedAddress\?\.phone/);
    expect(form).toMatch(/defaultValue=\{savedAddress\?\.address/);
    expect(form).toMatch(/defaultValue=\{savedAddress\?\.city/);
    expect(form).toMatch(/defaultValue=\{savedAddress\?\.postalCode/);
    expect(form).toMatch(/defaultValue=\{defaultEmail/);
  });

  it("only signed-in users see the save checkbox, and it submits saveAddress", () => {
    expect(form).toMatch(/\{showSaveOption && \(/);
    expect(form).toMatch(/name="saveAddress"/);
    expect(form).toMatch(/saveAddress: formData\.get\("saveAddress"\) === "on"/);
  });

  it("the save-after-order is best-effort (logged, never failing the order)", () => {
    const action = readSource("src/modules/checkout/actions.ts");
    // Spec change (no guest buying): the session gate above guarantees a user
    // here, so the old `&& session?.user?.id` guard was folded away.
    expect(action).toMatch(/if \(data\.saveAddress\)/);
    expect(action).toMatch(/console\.error\("Failed to save shipping address:"/);
    expect(action).toMatch(/upsertSavedShippingForUser/);
  });
});

describe("order actions removed; receipt + Review now kept", () => {
  const detail = readSource("src/app/account/orders/[id]/page.tsx");
  const list = readSource("src/app/account/orders/page.tsx");

  it("the order page offers only View receipt (no cancel, no buy again)", () => {
    expect(detail).toMatch(/\/receipt/);
    expect(detail).not.toMatch(/CancelOrderButton|canCustomerCancel|ReorderButton/);
  });

  it("the removed components and actions are really gone", () => {
    const actions = readSource("src/modules/orders/actions.ts");
    expect(actions).not.toMatch(/cancelMyOrder|reorderOrder|addToCart/);
    for (const gone of [
      "src/components/storefront/CancelOrderButton.tsx",
      "src/components/storefront/ReorderButton.tsx",
      "src/components/storefront/PrintButton.tsx",
      "src/modules/checkout/stock.ts",
      "src/modules/admin/stock.ts",
      "src/modules/admin/variation-ops.ts",
    ]) {
      expect(existsSync(join(ROOT, gone)), `${gone} should be deleted`).toBe(false);
    }
  });

  it("the receipt keeps its printable invoice and print:hidden chrome", () => {
    const receipt = readSource("src/app/account/orders/[id]/receipt/page.tsx");
    expect(receipt).toMatch(/getMyOrderForReceipt/);
    expect(receipt).toMatch(/print:hidden/);
    expect(receipt).not.toMatch(/<PrintButton/);
    expect(detail).toMatch(/\/receipt/);
  });

  it("a delivered order offers Review now — on the list row and per line item", () => {
    expect(list).toContain('order.orderStatus === "DELIVERED"');
    expect(list).toContain("Review now");
    // The list row is a container now: the order number is the link, so the
    // Review-now control is never nested inside another interactive element.
    expect(list).not.toMatch(/<Link\s+key=\{order\.id\}[\s\S]*?Review now/);
    expect(detail).toContain('order.orderStatus === "DELIVERED"');
    expect(detail).toContain("Review now");
    expect(detail).toContain("#reviews-heading");
    expect(detail).toContain("productSlug");
  });

  it("getMyOrderById joins the product slug for those links", () => {
    const queries = readSource("src/modules/orders/queries.ts");
    expect(queries).toMatch(/variation:\s*\{\s*select:\s*\{\s*product:\s*\{\s*select:\s*\{\s*slug:/);
    expect(queries).toContain("productSlug: i.variation.product.slug");
  });
});
