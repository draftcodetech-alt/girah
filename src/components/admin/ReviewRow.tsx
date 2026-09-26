"use client";

import { useState, useTransition } from "react";
import { setReviewStatus, type AdminReviewStatus } from "@/modules/admin";
import { formatDate } from "@/lib/format";

type AdminReview = {
  id: string;
  rating: number;
  text: string;
  status: string;
  createdAt: Date;
  product: { name: string; slug: string };
  user: { name: string; email: string };
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
};

export function ReviewRow({ review }: { review: AdminReview }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(review.status);
  const [error, setError] = useState<string | null>(null);

  function handle(next: AdminReviewStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setReviewStatus(review.id, next);
      if (result.success) {
        setStatus(next);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="py-4 border-b border-border">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <p className="font-body text-body font-medium text-charcoal">
            {review.product.name}{" "}
            <span className="text-gold" aria-label={`Rated ${review.rating} out of 5`}>
              <span aria-hidden="true">{"★".repeat(review.rating)}</span>
            </span>
          </p>
          <p className="font-body text-small text-muted mt-1">
            {review.user.name} · {review.user.email} · {formatDate(review.createdAt)}
          </p>
          <p className="font-body text-body text-charcoal mt-2">{review.text}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`font-body text-label font-semibold uppercase px-2 py-1 rounded-[var(--radius-control)] ${
              STATUS_BADGE[status] ?? "bg-sage-light text-charcoal"
            }`}
          >
            {status}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || status === "APPROVED"}
              onClick={() => handle("APPROVED")}
              className="h-9 px-4 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending || status === "REJECTED"}
              onClick={() => handle("REJECTED")}
              className="h-9 px-4 rounded-[var(--radius-control)] font-body text-button font-semibold border border-error text-error disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="font-body text-small text-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
