import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/modules/catalog";
import { formatPrice } from "@/lib/format";

type ProductCardProps = {
  product: ProductListItem;
  number?: string; // e.g. "01" — homepage editorial numbering only
};

export function ProductCard({ product, number }: ProductCardProps) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 rounded-[var(--radius-surface)]"
    >
      {number && (
        <span className="block font-body text-label tracking-[0.08em] text-sage mb-2">
          {number}
        </span>
      )}

      <div className="relative aspect-4/5 overflow-hidden bg-sage-light rounded-[var(--radius-surface)]">
        {product.mainImageUrl ? (
          <Image
            src={product.mainImageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted text-small">
            No image
          </div>
        )}

        {product.isOutOfStock && (
          <span className="absolute bottom-3 left-3 font-body text-label font-semibold tracking-[0.05em] uppercase text-charcoal bg-cream/90 px-2 py-1 rounded-[var(--radius-control)]">
            Out of Stock
          </span>
        )}
      </div>

      <h3 className="font-body text-card-title text-charcoal mt-4">{product.name}</h3>
      {product.ratingCount > 0 && (
        <span
          className="mt-1.5 flex items-center gap-1.5 font-body text-small text-sage"
          aria-label={`Rated ${product.ratingAverage} out of 5 from ${product.ratingCount} ${product.ratingCount === 1 ? "review" : "reviews"}`}
        >
          <span aria-hidden="true">★</span>
          <span aria-hidden="true">
            {product.ratingAverage?.toFixed(1)} ({product.ratingCount})
          </span>
        </span>
      )}
      <p className="font-body text-small text-sage mt-1.5">
        {/* startingPrice is 0 only when the product has no purchasable
            (enabled) variation — never render the nonsense "From Rs. 0". */}
        {product.startingPrice > 0 ? `From ${formatPrice(product.startingPrice)}` : "Unavailable"}
      </p>
      <span className="font-body text-small font-medium text-sage mt-3.5 inline-flex items-center gap-1 transition-transform duration-200 group-hover:translate-x-0.5">
        View →
      </span>
    </Link>
  );
}
