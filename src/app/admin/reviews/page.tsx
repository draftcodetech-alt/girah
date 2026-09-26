import Link from "next/link";
import { getAdminReviews, type AdminReviewStatus } from "@/modules/admin";
import { ReviewRow } from "@/components/admin/ReviewRow";

type Tab = { label: string; status?: AdminReviewStatus };

const TABS: Tab[] = [
  { label: "All" },
  { label: "Pending", status: "PENDING" },
  { label: "Approved", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" },
];

type AdminReviewsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const params = await searchParams;
  const active: AdminReviewStatus | undefined =
    params.status === "PENDING" || params.status === "APPROVED" || params.status === "REJECTED"
      ? params.status
      : undefined;

  const reviews = await getAdminReviews(active);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-6">
        Reviews
      </h1>

      <nav aria-label="Filter reviews" className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => {
          const isActive = tab.status === active;
          const href = tab.status ? `/admin/reviews?status=${tab.status}` : "/admin/reviews";
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`h-9 px-4 inline-flex items-center rounded-[var(--radius-control)] font-body text-small font-semibold border transition-colors ${
                isActive
                  ? "bg-sage text-cream border-sage"
                  : "border-border text-charcoal hover:border-sage"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {reviews.length === 0 ? (
        <p className="font-body text-body text-muted py-8">
          {active === "PENDING"
            ? "Nothing is waiting for moderation."
            : "No reviews here yet."}
        </p>
      ) : (
        <div>
          {reviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={{
                id: review.id,
                rating: review.rating,
                text: review.text,
                status: review.status,
                createdAt: review.createdAt,
                product: review.product,
                user: review.user,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
