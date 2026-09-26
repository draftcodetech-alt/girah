"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasVerifiedPurchase } from "./queries";
import type { ReviewActionResult, SubmitReviewInput } from "./types";

export async function submitReview(input: SubmitReviewInput): Promise<ReviewActionResult> {
  // Validate before touching request context or the DB (repo convention):
  // server actions are plain HTTP endpoints — the rating/text come from a form.
  const productId = typeof input?.productId === "string" ? input.productId : "";
  const rating = Number(input?.rating);
  const text = typeof input?.text === "string" ? input.text.trim() : "";

  if (!productId) {
    return { success: false, error: "This product no longer exists." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, error: "Choose a rating from 1 to 5." };
  }
  if (text.length < 3 || text.length > 1000) {
    return {
      success: false,
      error: "Your review must be between 3 and 1000 characters.",
    };
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Sign in to review this product." };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true },
  });
  if (!product) {
    return { success: false, error: "This product no longer exists." };
  }

  // Purchase gate is re-checked here — never trust the hidden productId the
  // client posted, and never trust that the form was only rendered for buyers.
  if (!(await hasVerifiedPurchase(userId, product.id))) {
    return { success: false, error: "Only verified buyers can review this product." };
  }

  try {
    // One review per user per product (DB unique on productId+userId): a
    // resubmit updates in place and re-enters the moderation queue.
    await db.review.upsert({
      where: { productId_userId: { productId: product.id, userId } },
      create: { productId: product.id, userId, rating, text, status: "PENDING" },
      update: { rating, text, status: "PENDING" },
    });
    revalidatePath(`/product/${product.slug}`);
    return { success: true };
  } catch (error) {
    console.error("submitReview failed:", error);
    return {
      success: false,
      error: "Something went wrong saving your review. Please try again.",
    };
  }
}
