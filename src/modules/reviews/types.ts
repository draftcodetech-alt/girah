export type ReviewActionResult = { success: true } | { success: false; error: string };

export type ReviewStatusValue = "PENDING" | "APPROVED" | "REJECTED";

export type ReviewView = {
  id: string;
  rating: number;
  text: string;
  reviewerName: string;
  createdAt: Date;
  isMine: boolean;
};

export type ProductRating = {
  average: number | null;
  count: number;
};

export type ProductReviewSummary = {
  reviews: ReviewView[];
  rating: ProductRating;
};

export type ExistingReview = {
  rating: number;
  text: string;
  status: ReviewStatusValue;
};

export type ReviewSubmissionState = {
  signedIn: boolean;
  purchased: boolean;
  existing: ExistingReview | null;
  canSubmit: boolean;
};

export type SubmitReviewInput = {
  productId: string;
  slug: string;
  rating: number;
  text: string;
};
