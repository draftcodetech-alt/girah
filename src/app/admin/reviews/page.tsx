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
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            MODERATION · {reviews.length} SHOWN
          </p>
          <h1 className="ax-title">
            Reviews<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">Approve or reject what customers wrote about the pieces.</p>
        </div>
      </div>

      <section className="ax-panel ax-panel--body">
        <nav aria-label="Filter reviews" className="ax-tabs mb-6">
          {TABS.map((tab) => {
            const isActive = tab.status === active;
            const href = tab.status ? `/admin/reviews?status=${tab.status}` : "/admin/reviews";
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`ax-tab${isActive ? " is-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {reviews.length === 0 ? (
          <p className="ax-sub py-8">
            {active === "PENDING"
              ? "Nothing is waiting for moderation."
              : "No reviews here yet."}
          </p>
        ) : (
          <div className="ax-rows">
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
      </section>
    </div>
  );
}
