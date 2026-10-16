import { describe, it, expect, vi } from "vitest";
import { checkoutSchema } from "@/modules/checkout/schema";
import {
  priceCartItemsFresh,
  UnavailableVariationError,
  InvalidQuantityError,
} from "@/modules/checkout/pricing";

// Phase B: checkout core without a database. priceCartItemsFresh takes a
// transaction client — a stub with productVariation.findMany is sufficient
// because pricing never touches any other table.
const VALID_INPUT = {
  fullName: "Test Buyer",
  phone: "03001234567",
  address: "12 Test Street",
  city: "Lahore",
  email: "buyer@example.com",
  paymentMethod: "COD" as const,
};

function mockTx(variations: unknown[]) {
  return {
    productVariation: { findMany: vi.fn().mockResolvedValue(variations) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function variation(overrides = {}) {
  return {
    id: "v1",
    name: "Small",
    price: 80000,
    isEnabled: true,
    product: { name: "Sunflower Bouquet" },
    ...overrides,
  };
}

describe("checkoutSchema", () => {
  it("accepts a complete COD order", () => {
    expect(checkoutSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it("rejects bad email, bad payment method, and blank name", () => {
    expect(
      checkoutSchema.safeParse({ ...VALID_INPUT, email: "not-an-email" }).success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...VALID_INPUT, paymentMethod: "CARD" }).success
    ).toBe(false);
    expect(checkoutSchema.safeParse({ ...VALID_INPUT, fullName: "  " }).success).toBe(false);
  });

  it("caps notes at 500 chars and accepts the save-address opt-in", () => {
    expect(
      checkoutSchema.safeParse({ ...VALID_INPUT, deliveryNotes: "x".repeat(501) }).success
    ).toBe(false);
    const parsed = checkoutSchema.safeParse({ ...VALID_INPUT, saveAddress: true });
    expect(parsed.success).toBe(true);
  });
});

describe("priceCartItemsFresh", () => {
  it("prices lines from live rows and sums the subtotal", async () => {
    const tx = mockTx([variation(), variation({ id: "v2", name: "Large", price: 120000 })]);
    const result = await priceCartItemsFresh(tx, [
      { variationId: "v1", quantity: 2 },
      { variationId: "v2", quantity: 1 },
    ]);
    expect(result.subtotal).toBe(80000 * 2 + 120000);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      productName: "Sunflower Bouquet",
      variationName: "Small",
      unitPrice: 80000,
    });
  });

  it("refuses missing and disabled variations with a human label", async () => {
    const tx = mockTx([variation({ isEnabled: false })]);
    const error = await priceCartItemsFresh(tx, [{ variationId: "v1", quantity: 1 }]).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(UnavailableVariationError);
    expect(error.itemLabel).toBe("Sunflower Bouquet — Small");

    const missing = await priceCartItemsFresh(mockTx([]), [
      { variationId: "ghost", quantity: 1 },
    ]).catch((e) => e);
    expect(missing).toBeInstanceOf(UnavailableVariationError);
    expect(missing.itemLabel).toBeUndefined();
  });

  it("refuses zero, negative, and fractional quantities before any math", async () => {
    for (const quantity of [0, -2, 1.5, Number.NaN]) {
      const error = await priceCartItemsFresh(mockTx([variation()]), [
        { variationId: "v1", quantity },
      ]).catch((e) => e);
      expect(error).toBeInstanceOf(InvalidQuantityError);
    }
  });
});
