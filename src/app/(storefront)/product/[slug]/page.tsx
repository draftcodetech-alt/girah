import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts, getProductBySlug } from "@/modules/catalog";
import {
  getProductReviewsAndRating,
  getReviewSubmissionState,
} from "@/modules/reviews";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { PurchasePanel } from "@/components/storefront/PurchasePanel";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ReviewForm } from "@/components/storefront/ReviewForm";
import { RatingStars } from "@/components/storefront/RatingStars";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const session = await auth();
  const [summary, submission, categoryProducts] = await Promise.all([
    getProductReviewsAndRating(product.id, session?.user?.id),
    getReviewSubmissionState(product.id),
    getProducts({ categorySlug: product.category.slug }),
  ]);
  const related = categoryProducts.filter((item) => item.slug !== product.slug).slice(0, 4);

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: product.category.name, href: `/shop?category=${product.category.slug}` },
          { label: product.name },
        ]}
      />
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="lg:w-[60%]">
          <ProductGallery images={product.images} alt={product.name} />
        </div>
        <div className="lg:w-[40%]">
          <PurchasePanel product={product} />
        </div>
      </div>

      <section aria-labelledby="reviews-heading" className="mt-16 border-t border-border pt-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="reviews-heading"
            className="font-[family-name:var(--font-display)] text-h2 text-charcoal"
          >
            Reviews
          </h2>
          {summary.rating.count > 0 && summary.rating.average !== null && (
            <RatingStars average={summary.rating.average} count={summary.rating.count} />
          )}
        </div>

        {!submission.signedIn ? (
          <p className="font-body text-body text-muted mt-6">
            <Link
              href={`/login?callbackUrl=/product/${product.slug}`}
              className="text-sage underline underline-offset-2 hover:text-charcoal"
            >
              Sign in
            </Link>{" "}
            to review this product.
          </p>
        ) : !submission.purchased ? (
          <p className="font-body text-body text-muted mt-6">
            Only verified buyers can review this item.
          </p>
        ) : (
          <div className="mt-6">
            {submission.existing && (
              <p
                role="status"
                className={`font-body text-small mb-4 ${
                  submission.existing.status === "APPROVED"
                    ? "text-success"
                    : submission.existing.status === "REJECTED"
                      ? "text-warning"
                      : "text-info"
                }`}
              >
                {submission.existing.status === "APPROVED"
                  ? "Your review is live. Updating it sends it back through moderation."
                  : submission.existing.status === "REJECTED"
                    ? "Your previous review wasn't approved — you can submit a new one."
                    : "Your review is awaiting approval."}
              </p>
            )}
            <ReviewForm
              productId={product.id}
              slug={product.slug}
              existing={submission.existing}
            />
          </div>
        )}

        {summary.reviews.length === 0 ? (
          <p className="font-body text-body text-muted mt-8">
            No reviews yet — once you&apos;ve placed an order, yours could be the first.
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {summary.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-[var(--radius-panel)] border border-border bg-cream p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-body text-card-title text-charcoal">
                      {review.reviewerName}
                      {review.isMine && (
                        <span className="font-body text-small text-muted"> (You)</span>
                      )}
                    </span>
                    <RatingStars average={review.rating} />
                  </div>
                  <span className="font-body text-small text-muted">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                <p className="font-body text-body text-muted mt-3 leading-relaxed">{review.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="mt-16 border-t border-border pt-12"
        >
          <h2
            id="related-heading"
            className="font-[family-name:var(--font-display)] text-h2 text-charcoal"
          >
            You may also like
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
