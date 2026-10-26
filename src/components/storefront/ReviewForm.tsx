"use client";

import { useActionState, useState } from "react";
import { submitReview } from "@/modules/reviews/actions";
import type { ExistingReview, ReviewActionResult } from "@/modules/reviews";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

type ReviewFormProps = {
  productId: string;
  slug: string;
  existing: ExistingReview | null;
};

const STAR_OPTIONS = [1, 2, 3, 4, 5];

export function ReviewForm({ productId, slug, existing }: ReviewFormProps) {
  // Star fill is driven by state so selecting N lights stars 1..N (the old
  // `peer-checked:text-gold` only lit the star whose OWN radio was checked —
  // pick 4 and 1-3 stayed gray). `hover` previews a rating before clicking;
  // it never overrides an already-chosen one.
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const activeStars = hover > 0 ? hover : rating;

  const [state, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(
    async (_previous, formData) =>
      submitReview({
        productId: String(formData.get("productId") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        rating: Number(formData.get("rating")),
        text: String(formData.get("text") ?? ""),
      }),
    null
  );

  if (state?.success) {
    return (
      <p role="status" className="font-body text-body text-success">
        Thanks — your review is awaiting approval.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 max-w-[640px]">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />

      <fieldset className="border-0 p-0 m-0">
        <legend className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
          Your rating
        </legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {STAR_OPTIONS.map((value) => (
            <label
              key={value}
              className="cursor-pointer"
              onMouseEnter={() => setHover(value)}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => {
                  setRating(value);
                  setHover(0);
                }}
                required={value === 1}
                onFocus={() => setHover(value)}
                onBlur={() => setHover(0)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`text-2xl leading-none transition-colors peer-focus-visible:rounded peer-focus-visible:ring-2 peer-focus-visible:ring-sage peer-focus-visible:ring-offset-2 ${
                  value <= activeStars ? "text-gold" : "text-placeholder"
                }`}
              >
                ★
              </span>
              <span className="sr-only">{value} star{value === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <Field label="Your review" htmlFor="review-text" error={state?.success === false ? state.error : null}>
          <textarea
            id="review-text"
            name="text"
            rows={4}
            minLength={3}
            maxLength={1000}
            required
            defaultValue={existing?.text ?? ""}
            placeholder="What did you love about it?"
            className="w-full min-h-[120px] rounded-[var(--radius-control)] border border-border bg-cream px-4 py-3 font-body text-body text-charcoal placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Submitting..." : existing ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
