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

  const dimension = size === "lg" ? "h-12 w-12 text-2xl" : "h-10 w-10 text-lg";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={wishlisted}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className={`${dimension} inline-flex items-center justify-center rounded-full border border-border bg-cream/90 text-sage hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-60 transition-colors`}
      >
        <span aria-hidden="true">{wishlisted ? "♥" : "♡"}</span>
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
