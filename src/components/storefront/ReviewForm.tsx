"use client";

import { useActionState } from "react";
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
        <div className="flex gap-1">
          {STAR_OPTIONS.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={value}
                defaultChecked={existing?.rating === value}
                required={value === 1}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="text-2xl leading-none text-placeholder transition-colors peer-checked:text-gold"
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
