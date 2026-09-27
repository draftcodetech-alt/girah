import Link from "next/link";
import { getStockAdjustmentFeed } from "@/modules/admin";
import { formatDate } from "@/lib/format";

const TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  hour: "2-digit",
  minute: "2-digit",
});

// Phase 13: cross-product stock audit feed — every adjustment, who made it
// (adminId NULL = customer cancel restock) and the reason, newest first.
export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const rows = await getStockAdjustmentFeed({ search });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-2">Stock history</h1>
      <p className="font-body text-small text-muted mb-6">
        Manual adjustments and cancel restocks across every product (newest first, latest 200).
      </p>

      <form method="GET" className="mb-6">
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Filter by product or variation..."
          className="w-full max-w-[400px] h-12 rounded-[var(--radius-control)] border border-border px-4 font-body text-body bg-cream"
        />
      </form>

      {rows.length === 0 ? (
        <p className="font-body text-body text-muted py-8">
          {search ? `No stock changes match “${search}”.` : "No stock adjustments recorded yet."}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="py-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-body text-body text-charcoal">
                  <Link
                    href={`/admin/products/${row.variation.product.id}`}
                    className="font-medium hover:text-sage underline-offset-2 hover:underline"
                  >
                    {row.variation.product.name}
                  </Link>{" "}
                  <span className="text-muted">— {row.variation.name}</span>
                </p>
                <p className="font-body text-small text-muted mt-1">{row.reason}</p>
              </div>
              <div className="text-right">
                <p className="font-body text-body text-charcoal">
                  {row.previousStock} → {row.newStock}{" "}
                  <span className={row.adjustment > 0 ? "text-success" : "text-error"}>
                    ({row.adjustment > 0 ? `+${row.adjustment}` : row.adjustment})
                  </span>
                </p>
                <p className="font-body text-small text-muted mt-1">
                  {row.admin ? row.admin.email : "Customer (order cancel)"} · {formatDate(row.createdAt)}{" "}
                  {TIME_LABEL.format(row.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
