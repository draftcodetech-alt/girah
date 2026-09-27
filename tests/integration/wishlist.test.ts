import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { toggleWishlist } from "@/modules/wishlist/actions";
import { getWishlistProducts, getWishlistProductIds } from "@/modules/wishlist/queries";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 15: wishlist — auth-first toggles, per-account scoping, cascade
// cleanup, and the card shape re-used from the catalog mapper.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

function signInAs(user: { id: string; email: string } | null) {
  authMock.mockResolvedValue(user ? { user } : null);
}

let seq = 0;

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

describe("toggleWishlist", () => {
  it("refuses a guest with the signed-in message and stores nothing", async () => {
    signInAs(null);
    const { product } = await createTestProduct();
    const result = await toggleWishlist(product.id);
    expect(result).toEqual({ success: false, error: "You must be signed in." });
    expect(await db.wishlistItem.count()).toBe(0);
  });

  it("adds then removes — one row, never duplicates", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const { product } = await createTestProduct();

    const added = await toggleWishlist(product.id);
    expect(added).toEqual({ success: true, added: true });
    expect(await db.wishlistItem.count({ where: { userId: user.id } })).toBe(1);

    const removed = await toggleWishlist(product.id);
    expect(removed).toEqual({ success: true, added: false });
    expect(await db.wishlistItem.count({ where: { userId: user.id } })).toBe(0);
  });

  it("reports a missing product as not found and stores nothing", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const result = await toggleWishlist("no-such-product-id");
    expect(result).toEqual({ success: false, error: "Product not found." });
    expect(await db.wishlistItem.count()).toBe(0);
  });

  it("refuses an empty product id without touching the database", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const result = await toggleWishlist("");
    expect(result.success).toBe(false);
    expect(await db.wishlistItem.count()).toBe(0);
  });

  it("the unique pair keeps concurrent double-clicks to one row", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const { product } = await createTestProduct();
    // Two "requests" racing: the second create must violate
    // (userId, productId), not append a duplicate.
    await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
    await expect(
      db.wishlistItem.create({ data: { userId: user.id, productId: product.id } })
    ).rejects.toThrow();
    expect(await db.wishlistItem.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("getWishlistProducts", () => {
  it("returns the card shape for the signed-in user, newest save first", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const { product: older } = await createTestProduct();
    const { product: newer } = await createTestProduct();
    await db.wishlistItem.create({ data: { userId: user.id, productId: older.id } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.wishlistItem.create({ data: { userId: user.id, productId: newer.id } });

    const items = await getWishlistProducts();
    expect(items.map((i) => i.id)).toEqual([newer.id, older.id]);
    const [first] = items;
    expect(first).toMatchObject({
      name: expect.any(String),
      slug: expect.any(String),
      mainImageUrl: null,
      startingPrice: 100_000,
      isOutOfStock: false,
      ratingCount: 0,
      ratingAverage: null,
    });
  });

  it("shows an empty list to a guest", async () => {
    signInAs(null);
    expect(await getWishlistProducts()).toEqual([]);
  });

  it("never leaks another account's saved items", async () => {
    const alice = await createTestUser({ email: `alice-${seq++}-${Date.now()}@girah.test` });
    const bob = await createTestUser({ email: `bob-${seq++}-${Date.now()}@girah.test` });
    const { product } = await createTestProduct();
    await db.wishlistItem.create({ data: { userId: alice.id, productId: product.id } });

    signInAs({ id: bob.id, email: bob.email });
    expect(await getWishlistProducts()).toEqual([]);
    expect(await getWishlistProductIds()).toEqual([]);

    signInAs({ id: alice.id, email: alice.email });
    expect((await getWishlistProducts()).map((i) => i.id)).toEqual([product.id]);
    expect(await getWishlistProductIds()).toEqual([product.id]);
  });

  it("guest id lookups are empty too", async () => {
    signInAs(null);
    expect(await getWishlistProductIds()).toEqual([]);
  });
});

describe("cascade cleanup", () => {
  it("deleting a product removes its wishlist rows", async () => {
    const user = await createTestUser();
    signInAs({ id: user.id, email: user.email });
    const { product } = await createTestProduct();
    await toggleWishlist(product.id);

    await db.product.delete({ where: { id: product.id } });
    expect(await db.wishlistItem.count()).toBe(0);
  });

  it("deleting an account removes its wishlist rows", async () => {
    const user = await createTestUser();
    const { product } = await createTestProduct();
    await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });

    await db.user.delete({ where: { id: user.id } });
    expect(await db.wishlistItem.count()).toBe(0);
    // The product itself survives a wishlist/account deletion.
    expect(await db.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });
});
