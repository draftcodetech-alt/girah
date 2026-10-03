"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlist } from "@/modules/wishlist";

type WishlistButtonProps = {
  productId: string;
  wishlisted?: boolean;
  /** Larger control for the product page (default is the card overlay). */
  size?: "sm" | "lg";
};

export function WishlistButton({ productId, wishlisted = false, size = "sm" }: WishlistButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await toggleWishlist(productId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const dimension = size === "lg" ? "h-12 w-12 text-2xl" : "h-11 w-11";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={wishlisted}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className={`${dimension} inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-60 ${size === "lg" ? "border border-border bg-cream/90 text-sage hover:bg-cream transition-colors" : ""}`}
      >
        {/* Card overlay (sm): mockup's stroked SVG heart — .pcard__heart in
            globals.css paints the circle and the red pressed state. The
            product panel (lg) keeps the heavier text glyph. */}
        {size === "sm" ? (
          <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" className="pcard-heart-svg">
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.8 6.7 4.8c2 0 3.6 1.1 5.3 3.2 1.7-2.1 3.3-3.2 5.3-3.2 3.3 0 5.2 3.2 4 6.5-1.8 4.6-9.3 9.2-9.3 9.2z" />
          </svg>
        ) : (
          <span aria-hidden="true">{wishlisted ? "♥" : "♡"}</span>
        )}
      </button>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 z-20 whitespace-nowrap rounded-[var(--radius-control)] border border-border bg-cream px-2 py-1 font-body text-small text-error shadow-[var(--shadow-elevated)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
