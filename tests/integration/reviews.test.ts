import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  getReviewSubmissionState,
  getProductReviewsAndRating,
} from "@/modules/reviews";
import { submitReview } from "@/modules/reviews/actions";
import { getAdminReviews, setReviewStatus } from "@/modules/admin/reviews";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 10: verified-buyers-only review submission (validate-first, purchase
// gate re-checked server side), one row per user per product via upsert, and
// APPROVED-only storefront visibility with an average that never counts
// PENDING/REJECTED rows.

const authMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/require-admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let seedCounter = 0;

async function seedPurchase(
  userId: string,
  productId: string,
  variationId: string,
  orderStatus: "CONFIRMED" | "CANCELLED" = "CONFIRMED"
) {
  seedCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-REV${Date.now()}${seedCounter}`,
      customerName: "Review Tester",
      customerEmail: "reviewer@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 11",
      shippingCity: "Lahore",
      subtotal: 100_000,
      total: 100_000,
      paymentMethod: "COD",
      orderStatus,
      userId,
      items: {
        create: {
          variationId,
          productName: "Review Product",
          variationName: "Default",
          unitPrice: 100_000,
          quantity: 1,
          subtotal: 100_000,
        },
      },
    },
  });
}

function signInAs(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId } });
}

const input = (productId: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  productId,
  slug: "product-under-test",
  rating: 5,
  text: "Lovely embroidery and a perfect fit.",
  ...overrides,
});

describe("submitReview submission gate", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
    requireAdminMock.mockReset();
  });

  it("refuses an anonymous visitor before touching the DB", async () => {
    const { product } = await createTestProduct();
    authMock.mockResolvedValue(null);

    const result = await submitReview(input(product.id));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/sign in/i);
    expect(await db.review.count()).toBe(0);
  });

  it("refuses a signed-in user who never bought the product", async () => {
    const { product } = await createTestProduct();
    const user = await createTestUser();
    signInAs(user.id);

    const result = await submitReview(input(product.id));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/verified buyers/i);
    expect(await db.review.count()).toBe(0);
  });

  it("refuses when the only order was cancelled", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id, "CANCELLED");
    signInAs(user.id);

    const result = await submitReview(input(product.id));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/verified buyers/i);
  });

  it("accepts a verified buyer and stores the review PENDING", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser({ name: "Ayesha Khan" });
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);

    const result = await submitReview(input(product.id, { rating: 4 }));
    expect(result.success).toBe(true);

    const rows = await db.review.findMany({ where: { productId: product.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: user.id, rating: 4, status: "PENDING" });
  });

  it("validates rating and text before any request context", async () => {
    const { product } = await createTestProduct();
    authMock.mockResolvedValue(null);

    const badRating = await submitReview(input(product.id, { rating: 6 }));
    expect(badRating.success).toBe(false);
    if (!badRating.success) expect(badRating.error).toMatch(/rating from 1 to 5/i);

    const fractional = await submitReview(input(product.id, { rating: 4.5 }));
    expect(fractional.success).toBe(false);

    const tooShort = await submitReview(input(product.id, { text: "ab" }));
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) expect(tooShort.error).toMatch(/between 3 and 1000/i);

    const tooLong = await submitReview(input(product.id, { text: "x".repeat(1001) }));
    expect(tooLong.success).toBe(false);

    const noProduct = await submitReview(input(""));
    expect(noProduct.success).toBe(false);

    expect(await db.review.count()).toBe(0);
  });

  it("rejects a product id that no longer exists", async () => {
    const user = await createTestUser();
    signInAs(user.id);

    const result = await submitReview(input("does-not-exist"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no longer exists/i);
  });

  it("keeps ONE row per user per product and resets it to PENDING on resubmit", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);

    expect((await submitReview(input(product.id, { rating: 4 }))).success).toBe(true);
    // Author resubmits after approval — moderation must run again.
    await db.review.updateMany({ data: { status: "APPROVED" } });
    expect(
      (await submitReview(input(product.id, { rating: 2, text: "Changed my mind entirely." })))
        .success
    ).toBe(true);

    const rows = await db.review.findMany({ where: { productId: product.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 2, status: "PENDING" });
    expect(rows[0].text).toBe("Changed my mind entirely.");
  });
});

describe("review submission state", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
    requireAdminMock.mockReset();
  });

  it("reports signed-out visitors as unable to submit", async () => {
    const { product } = await createTestProduct();
    authMock.mockResolvedValue(null);

    const state = await getReviewSubmissionState(product.id);
    expect(state).toEqual({ signedIn: false, purchased: false, existing: null, canSubmit: false });
  });

  it("prefills the author's existing review for a buyer", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);
    await submitReview(input(product.id, { text: "Beautiful craftsmanship." }));

    const state = await getReviewSubmissionState(product.id);
    expect(state.signedIn).toBe(true);
    expect(state.purchased).toBe(true);
    expect(state.canSubmit).toBe(true);
    expect(state.existing).toEqual({
      rating: 5,
      text: "Beautiful craftsmanship.",
      status: "PENDING",
    });
  });

  it("hides the form from signed-in non-buyers even if they try", async () => {
    const { product } = await createTestProduct();
    const user = await createTestUser();
    signInAs(user.id);

    const state = await getReviewSubmissionState(product.id);
    expect(state.purchased).toBe(false);
    expect(state.canSubmit).toBe(false);
    expect(state.existing).toBeNull();
  });
});

describe("storefront visibility and rating math", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
    requireAdminMock.mockReset();
  });

  it("shows APPROVED reviews only, with APPROVED-only averages", async () => {
    const { product, variation } = await createTestProduct();
    const buyerA = await createTestUser({ name: "Ayesha Khan" });
    const buyerB = await createTestUser({ name: "Zara Ahmed" });
    const buyerC = await createTestUser({ name: "Madam" });
    for (const buyer of [buyerA, buyerB, buyerC]) {
      await seedPurchase(buyer.id, product.id, variation.id);
      signInAs(buyer.id);
    }

    signInAs(buyerA.id);
    await submitReview(input(product.id, { rating: 5, text: "Excellent, would buy again." }));
    signInAs(buyerB.id);
    await submitReview(input(product.id, { rating: 1, text: "Not for me at all." }));
    signInAs(buyerC.id);
    await submitReview(input(product.id, { rating: 4, text: "Solid everyday piece." }));

    await db.review.updateMany({ where: { userId: buyerA.id }, data: { status: "APPROVED" } });
    await db.review.updateMany({ where: { userId: buyerC.id }, data: { status: "REJECTED" } });

    const summary = await getProductReviewsAndRating(product.id);
    expect(summary.rating).toEqual({ average: 5, count: 1 });
    expect(summary.reviews).toHaveLength(1);
    expect(summary.reviews[0].reviewerName).toBe("Ayesha K.");
    expect(summary.reviews[0].isMine).toBe(false);
  });

  it("averages multiple APPROVED rows and flags the viewer's own review", async () => {
    const { product, variation } = await createTestProduct();
    const buyerA = await createTestUser({ name: "Ali b" });
    const buyerB = await createTestUser({ name: "Hina" });
    for (const buyer of [buyerA, buyerB]) {
      await seedPurchase(buyer.id, product.id, variation.id);
      signInAs(buyer.id);
      await submitReview(
        input(product.id, { rating: buyer.id === buyerA.id ? 5 : 4, text: "Great product." })
      );
    }
    await db.review.updateMany({ data: { status: "APPROVED" } });

    const summary = await getProductReviewsAndRating(product.id, buyerA.id);
    expect(summary.rating).toEqual({ average: 4.5, count: 2 });
    const mine = summary.reviews.find((review) => review.isMine);
    expect(mine?.reviewerName).toBe("Ali B.");
    expect(summary.reviews.filter((review) => review.isMine)).toHaveLength(1);
  });

  it("returns an empty summary when nothing is approved", async () => {
    const { product } = await createTestProduct();
    const summary = await getProductReviewsAndRating(product.id);
    expect(summary).toEqual({ reviews: [], rating: { average: null, count: 0 } });
  });
});

describe("admin moderation", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("lists reviews newest first, optionally filtered by status", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);
    await submitReview(input(product.id, { text: "Queued for moderation." }));

    const all = await getAdminReviews();
    expect(all).toHaveLength(1);
    expect(all[0].product.slug).toBe(product.slug);
    expect(all[0].user.email).toBe(user.email);

    expect(await getAdminReviews("APPROVED")).toHaveLength(0);
    expect(await getAdminReviews("PENDING")).toHaveLength(1);
  });

  it("approves a review and makes it visible on the storefront", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);
    await submitReview(input(product.id, { text: "Awaiting the moderator." }));

    const [pending] = await getAdminReviews("PENDING");
    const result = await setReviewStatus(pending.id, "APPROVED");
    expect(result.success).toBe(true);

    expect((await db.review.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      "APPROVED"
    );
    const summary = await getProductReviewsAndRating(product.id);
    expect(summary.rating.count).toBe(1);
  });

  it("rejecting a review withdraws it from the storefront", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);
    await submitReview(input(product.id, { text: "Will be rejected." }));
    const [pending] = await getAdminReviews("PENDING");

    expect((await setReviewStatus(pending.id, "REJECTED")).success).toBe(true);
    expect((await getProductReviewsAndRating(product.id)).rating.count).toBe(0);
    expect(await getAdminReviews("REJECTED")).toHaveLength(1);
  });

  it("validates the target status", async () => {
    const { product, variation } = await createTestProduct();
    const user = await createTestUser();
    await seedPurchase(user.id, product.id, variation.id);
    signInAs(user.id);
    await submitReview(input(product.id, { text: "Status probe row." }));
    const [pending] = await getAdminReviews("PENDING");

    const bogus = await setReviewStatus(pending.id, "NOT_A_STATUS" as never);
    expect(bogus.success).toBe(false);
    if (!bogus.success) expect(bogus.error).toMatch(/invalid review status/i);
    expect((await db.review.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      "PENDING"
    );
  });

  it("gates both entry points behind requireAdmin", async () => {
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(getAdminReviews()).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(setReviewStatus("any-id", "APPROVED")).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
