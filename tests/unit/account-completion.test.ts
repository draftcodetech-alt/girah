import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { canCustomerCancel } from "@/modules/orders/status-ops";
import { savedShippingSchema } from "@/modules/addresses";
import { checkoutSchema } from "@/modules/checkout/schema";

// Phase 12 (account completion): cancel eligibility is the ONE rule shared
// by the order page (renders the button) and the action (re-validates), so
// its matrix lives here as a pure unit. Plus schema composition and the
// source-level shell wiring (nav, prefill, receipt, two-step confirms).

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), "utf8");

const eligibility = (orderStatus: string, paymentStatus: string) =>
  canCustomerCancel({ orderStatus, paymentStatus });

describe("Phase 12: canCustomerCancel (unpaid-only scope)", () => {
  it("allows PENDING orders with a pending payment", () => {
    expect(eligibility("PENDING", "PENDING")).toBe(true);
  });

  it("allows CONFIRMED orders with a pending payment", () => {
    expect(eligibility("CONFIRMED", "PENDING")).toBe(true);
  });

  it.each(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])(
    "refuses %s orders even when unpaid (already prepared / terminal)",
    (orderStatus) => {
      expect(eligibility(orderStatus, "PENDING")).toBe(false);
    }
  );

  it.each(["PAID", "REFUNDED", "FAILED"])(
    "refuses %s orders — the customer path is refund-free",
    (paymentStatus) => {
      expect(eligibility("PENDING", paymentStatus)).toBe(false);
      expect(eligibility("CONFIRMED", paymentStatus)).toBe(false);
    }
  );
});

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
    expect(action).toMatch(/if \(data\.saveAddress && session\?\.user\?\.id\)/);
    expect(action).toMatch(/console\.error\("Failed to save shipping address:"/);
    expect(action).toMatch(/upsertSavedShippingForUser/);
  });
});

describe("Phase 12: cancel / reorder / receipt wiring", () => {
  const detail = readSource("src/app/account/orders/[id]/page.tsx");

  it("the order page gates Cancel behind the shared eligibility rule", () => {
    expect(detail).toMatch(/canCustomerCancel\(order\)/);
    expect(detail).toMatch(/<CancelOrderButton/);
  });

  it("cancel is a two-step confirm surfaced inline with role=alert", () => {
    const button = readSource("src/components/storefront/CancelOrderButton.tsx");
    expect(button).toMatch(/^"use client"/);
    expect(button).toMatch(/setConfirming\(true\)/);
    expect(button).toMatch(/Yes, cancel order #/);
    expect(button).toMatch(/role="alert"/);
  });

  it("reorder stays on the page and reports via role=status / role=alert", () => {
    const button = readSource("src/components/storefront/ReorderButton.tsx");
    expect(button).toMatch(/^"use client"/);
    expect(button).toMatch(/role="status"/);
    expect(button).toMatch(/role="alert"/);
    expect(button).not.toMatch(/router\.push/);
    expect(detail).toMatch(/<ReorderButton/);
  });

  it("the receipt page hides its chrome when printing", () => {
    const receipt = readSource("src/app/account/orders/[id]/receipt/page.tsx");
    expect(receipt).toMatch(/getMyOrderForReceipt/);
    expect(receipt).toMatch(/print:hidden/);
    expect(receipt).toMatch(/<PrintButton/);
    expect(detail).toMatch(/\/receipt/);
  });

  it("reorder replays through the one addToCart implementation", () => {
    const actions = readSource("src/modules/orders/actions.ts");
    expect(actions).toMatch(/import \{ addToCart \} from "@\/modules\/cart"/);
    expect(actions).toMatch(/addToCart\(item\.variationId, item\.quantity\)/);
  });
});
