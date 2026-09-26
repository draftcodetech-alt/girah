import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  priceCartItemsFresh,
  InvalidQuantityError,
  UnavailableVariationError,
} from "@/modules/checkout/pricing";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 1 C1 defense-in-depth: pricing must never compute a negative or
// fractional subtotal even if a bad quantity slips into a cart row.

describe("priceCartItemsFresh", () => {
  beforeEach(resetDb);

  it("throws InvalidQuantityError for quantity 0", async () => {
    const { variation } = await createTestProduct();

    await expect(
      db.$transaction((tx) =>
        priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: 0 }])
      )
    ).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it("throws InvalidQuantityError for negative quantity", async () => {
    const { variation } = await createTestProduct();

    await expect(
      db.$transaction((tx) =>
        priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: -50 }])
      )
    ).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it("throws InvalidQuantityError for fractional quantity", async () => {
    const { variation } = await createTestProduct();

    await expect(
      db.$transaction((tx) =>
        priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: 1.5 }])
      )
    ).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it("throws UnavailableVariationError for a disabled variation", async () => {
    const { variation } = await createTestProduct();
    await db.productVariation.update({
      where: { id: variation.id },
      data: { isEnabled: false },
    });

    await expect(
      db.$transaction((tx) =>
        priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: 1 }])
      )
    ).rejects.toBeInstanceOf(UnavailableVariationError);
  });

  it("carries a human item label so checkout can NAME the unavailable item", async () => {
    const { product, variation } = await createTestProduct();
    await db.productVariation.update({
      where: { id: variation.id },
      data: { isEnabled: false },
    });

    const error = await db
      .$transaction((tx) =>
        priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: 1 }])
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnavailableVariationError);
    const labeled = error as UnavailableVariationError;
    expect(labeled.itemLabel).toBe(`${product.name} — ${variation.name}`);
  });

  it("prices valid quantities correctly (integer paisa)", async () => {
    const { variation } = await createTestProduct();

    const { lines, subtotal } = await db.$transaction((tx) =>
      priceCartItemsFresh(tx, [{ variationId: variation.id, quantity: 2 }])
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].unitPrice).toBe(100_000);
    expect(lines[0].subtotal).toBe(200_000);
    expect(subtotal).toBe(200_000);
  });
});
