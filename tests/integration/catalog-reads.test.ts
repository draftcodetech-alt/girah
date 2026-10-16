import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { getProductBySlug, getProducts } from "@/modules/catalog";
import { getWishlistProductIds } from "@/modules/wishlist/queries";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 1 integration: read-only catalog paths. Three contracts that are easy
// to break silently — a slug miss must be `null` (the product page relies on
// it to decide notFound()), the related-products recipe must stay inside the
// product's own category and never echo the product itself, and the wishlist
// id list is per-account with no cross-account bleed.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

function signInAs(user: { id: string; email: string } | null) {
  authMock.mockResolvedValue(user ? { user } : null);
}

let seq = 0;

/** A product inside an EXISTING category — createTestProduct always mints its own. */
async function productIn(categoryId: string, name: string) {
  seq += 1;
  return db.product.create({
    data: {
      name,
      slug: `read-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${seq}`,
      description: "Read-path fixture",
      categoryId,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

describe("getProductBySlug", () => {
  it("returns null for a slug that does not exist", async () => {
    expect(await getProductBySlug("no-such-slug")).toBeNull();
  });

  it("returns null for a product that was deleted (stale link)", async () => {
    const { product } = await createTestProduct();
    await db.product.delete({ where: { id: product.id } });
    expect(await getProductBySlug(product.slug)).toBeNull();
  });

  it("returns the full detail shape for a live slug", async () => {
    const { product, variation, category } = await createTestProduct();

    const detail = await getProductBySlug(product.slug);
    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: { name: category.name, slug: category.slug },
    });
    expect(detail!.variations.map((v) => v.id)).toContain(variation.id);
    expect(detail!.variations[0]).toMatchObject({
      price: expect.any(Number),
      stock: expect.any(Number),
      isEnabled: true,
    });
  });
});

describe("related products (same-category, self excluded)", () => {
  // The storefront computes related products inline in
  // src/app/(storefront)/product/[slug]/page.tsx: it pulls the category's
  // cards and drops the product being viewed. There is no getRelatedProducts
  // export, so this test pins the exact recipe that page runs — if the page
  // is ever extracted into a query, move these assertions with it.
  async function relatedFor(productSlug: string, categorySlug: string) {
    const cards = await getProducts({ categorySlug });
    return cards.filter((item) => item.slug !== productSlug).slice(0, 4);
  }

  it("returns other products from the same category and never the product itself", async () => {
    const { product, category } = await createTestProduct();
    const sibling = await productIn(category.id, "Sibling Piece");

    const related = await relatedFor(product.slug, category.slug);
    expect(related.map((r) => r.id)).toEqual([sibling.id]);
    expect(related.map((r) => r.id)).not.toContain(product.id);
  });

  it("never pulls in a product from a different category", async () => {
    const { product, category } = await createTestProduct();
    const other = await createTestProduct(); // fresh category

    const related = await relatedFor(product.slug, category.slug);
    expect(related.map((r) => r.id)).not.toContain(other.product.id);
  });

  it("is empty when the product is alone in its category", async () => {
    const { product, category } = await createTestProduct();
    expect(await relatedFor(product.slug, category.slug)).toEqual([]);
  });
});

describe("getWishlistProductIds", () => {
  it("returns only the caller's saved ids", async () => {
    const alice = await createTestUser({ email: `alice-ids-${Date.now()}@girah.test` });
    const bob = await createTestUser({ email: `bob-ids-${Date.now()}@girah.test` });
    const a1 = await createTestProduct();
    const a2 = await createTestProduct();
    const b1 = await createTestProduct();

    await db.wishlistItem.createMany({
      data: [
        { userId: alice.id, productId: a1.product.id },
        { userId: alice.id, productId: a2.product.id },
        { userId: bob.id, productId: b1.product.id },
      ],
    });

    signInAs({ id: alice.id, email: alice.email });
    const ids = await getWishlistProductIds();
    expect(ids.sort()).toEqual([a1.product.id, a2.product.id].sort());

    signInAs({ id: bob.id, email: bob.email });
    expect(await getWishlistProductIds()).toEqual([b1.product.id]);
  });

  it("answers a signed-out caller with no ids at all", async () => {
    const user = await createTestUser();
    const { product } = await createTestProduct();
    await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });

    signInAs(null);
    expect(await getWishlistProductIds()).toEqual([]);
  });
});
