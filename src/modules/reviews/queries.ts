import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatReviewerName } from "./format";
import type { ProductReviewSummary, ReviewSubmissionState } from "./types";

/** APPROVED reviews only — PENDING/REJECTED rows must never reach the storefront. */
export async function getProductReviewsAndRating(
  productId: string,
  viewerId?: string
): Promise<ProductReviewSummary> {
  const reviews = await db.review.findMany({
    where: { productId, status: "APPROVED" },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10
      : null;

  return {
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      text: review.text,
      reviewerName: formatReviewerName(review.user.name),
      createdAt: review.createdAt,
      isMine: viewerId !== undefined && review.userId === viewerId,
    })),
    rating: { average, count },
  };
}

/**
 * Verified purchase = at least one NON-CANCELLED order (this user) containing
 * any variation of the product. Phase 10 decision: only these accounts may review.
 */
export async function hasVerifiedPurchase(userId: string, productId: string): Promise<boolean> {
  const order = await db.order.findFirst({
    where: {
      userId,
      orderStatus: { not: "CANCELLED" },
      items: { some: { variation: { productId } } },
    },
    select: { id: true },
  });
  return order !== null;
}

export async function getReviewSubmissionState(
  productId: string
): Promise<ReviewSubmissionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { signedIn: false, purchased: false, existing: null, canSubmit: false };
  }

  const [purchased, existing] = await Promise.all([
    hasVerifiedPurchase(userId, productId),
    db.review.findUnique({
      where: { productId_userId: { productId, userId } },
      select: { rating: true, text: true, status: true },
    }),
  ]);

  return {
    signedIn: true,
    purchased,
    existing,
    // A REJECTED review still lets the author resubmit (the upsert resets it
    // to PENDING for a fresh moderation pass).
    canSubmit: purchased,
  };
}
