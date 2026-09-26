"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";

export type AdminReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

const STATUSES: AdminReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export async function getAdminReviews(status?: AdminReviewStatus) {
  await requireAdmin();
  return db.review.findMany({
    where: status ? { status } : {},
    include: {
      product: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function setReviewStatus(
  reviewId: string,
  status: AdminReviewStatus
): Promise<AdminActionResult> {
  await requireAdmin();

  if (!STATUSES.includes(status)) {
    return { success: false, error: "Invalid review status." };
  }

  try {
    const review = await db.review.update({
      where: { id: reviewId },
      data: { status },
      include: { product: { select: { slug: true } } },
    });
    // The storefront caches nothing, but the product page must reflect the
    // new visibility immediately (approved → shown, rejected → withdrawn).
    revalidatePath(`/product/${review.product.slug}`);
    revalidatePath("/admin/reviews");
    return { success: true };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return { success: false, error: "Review not found — reload the page and try again." };
    }
    console.error("setReviewStatus failed:", error);
    return { success: false, error: "Something went wrong updating the review. Please try again." };
  }
}
