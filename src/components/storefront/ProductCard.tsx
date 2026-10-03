import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/modules/catalog";
import { formatPrice } from "@/lib/format";
import { WishlistButton } from "./WishlistButton";

type ProductCardProps = {
  product: ProductListItem;
  wishlisted?: boolean;
  /** LCP hint — first homepage card only. */
  priority?: boolean;
};

// The approved card mockup (assets/product-photos/index(1).html): paper shell,
// warm stage with an olive category badge, serif title/price, tagline, perks
// row and a pill CTA. All card styling lives in the scoped .pcard block in
// globals.css — this component only owns structure and the data wiring.
export function ProductCard({ product, wishlisted, priority }: ProductCardProps) {
  const filledStars = Math.max(0, Math.min(5, Math.round(product.ratingAverage ?? 0)));

  return (
    <div className="pcard">
      <Link href={`/product/${product.slug}`} className="pcard__link">
        <div className="pcard__stage">
          <span className="pcard__badge">{product.categoryName}</span>
          {product.mainImageUrl ? (
            <Image
              src={product.mainImageUrl}
              alt={product.name}
              fill
              priority={priority}
              className="pcard__img object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            />
          ) : (
            <span className="pcard__placeholder">No image</span>
          )}

          {product.isOutOfStock && <span className="pcard__oos">Out of Stock</span>}
        </div>

        <div className="pcard__info">
          <h3 className="pcard__title">{product.name}</h3>
          <p className="pcard__tagline">
            Handmade<i>•</i>Fresh Blooms<i>•</i>Lasts Forever
          </p>

          <div className="pcard__meta">
            <div className="pcard__price">
              {/* startingPrice is 0 only when the product has no purchasable
                  (enabled) variation — never render the nonsense "From Rs. 0". */}
              {product.startingPrice > 0
                ? `From ${formatPrice(product.startingPrice)}`
                : "Unavailable"}
            </div>
            {/* Reviews-on-cards is a Phase 10 storefront guarantee (E2E:
                "shop card shows the star line after approval") — kept despite the
                design doc's card-minimalism note: no downgrades. */}
            <div className="pcard__rating">
              {product.ratingCount > 0 && (
                <span
                  aria-label={`Rated ${product.ratingAverage} out of 5 from ${product.ratingCount} ${product.ratingCount === 1 ? "review" : "reviews"}`}
                >
                  <span className="pcard__stars" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg key={i} viewBox="0 0 24 24" width="14" height="14" fill={i < filledStars ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4">
                        <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" />
                      </svg>
                    ))}
                  </span>
                  <span aria-hidden="true">({product.ratingCount})</span>
                </span>
              )}
            </div>
          </div>

          <div className="pcard__foot">
            <div className="pcard__perks">
              <span className="pcard__perk">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 20C5 11 10 5 20 4c0 10-5 16-13 16" />
                  <path d="M4 21c3-6 7-10 11-12" />
                </svg>
                100% Handmade
              </span>
              <span className="pcard__perk">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 6h12v10H2z" />
                  <path d="M14 9h4l4 4v3h-8" />
                  <circle cx="7" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                </svg>
                Worldwide Shipping
              </span>
            </div>

            {/* Whole-card Link: the CTA is decorative, never a nested button.
                margin-left:auto keeps it right of the perks; on narrow cards
                it wraps to its own line, still right-aligned. */}
            <span className="pcard__cta">
              View Details
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h16M14 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
      {/* Phase 15: heart sits OUTSIDE the card Link — a button must never
          nest inside an anchor (the click would navigate, not toggle). */}
      <div className="pcard__heart">
        <WishlistButton productId={product.id} wishlisted={wishlisted} />
      </div>
    </div>
  );
}
