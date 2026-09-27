import Link from "next/link";
import { getDashboardMetrics, LOW_STOCK_THRESHOLD } from "@/modules/admin";
import { formatPrice, formatDate } from "@/lib/format";

// Phase 13: real dashboard (was a 3-line stub). Everything renders on the
// server — the revenue chart is plain SVG, zero client JS, design tokens
// only. Metrics come from one bounded read (getDashboardMetrics).
const CHART_W = 700;
const CHART_H = 170;
const CHART_PAD_BOTTOM = 26;
const BAR_SLOT = CHART_W / 14;
const BAR_W = BAR_SLOT - 8;

export default async function AdminDashboard() {
  const metrics = await getDashboardMetrics();
  const peak = Math.max(...metrics.series.map((point) => point.revenue), 0);
  const statusMax = Math.max(...metrics.ordersByStatus.map((row) => row.count), 1);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-1">Dashboard</h1>
      <p className="font-body text-small text-muted mb-8">Store at a glance — updated on every page load.</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Revenue · 30d" value={formatPrice(metrics.revenue30)} hint="Paid orders only" />
        <KpiCard label="Orders · 30d" value={String(metrics.orders30)} hint="All statuses" />
        <KpiCard label="New customers · 30d" value={String(metrics.customers30)} hint="Accounts created" />
        <KpiCard
          label="Pending reviews"
          value={String(metrics.pendingReviews)}
          hint="Awaiting moderation"
          href="/admin/reviews?status=PENDING"
        />
        <KpiCard
          label="Low stock"
          value={String(metrics.lowStockCount)}
          hint={`Enabled, ≤ ${LOW_STOCK_THRESHOLD} left`}
          href="/admin/stock"
        />
      </div>

      {/* 14-day revenue chart — server-rendered SVG */}
      <section className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Revenue — last 14 days
        </h2>
        {peak === 0 ? (
          <p className="font-body text-body text-muted py-8">
            No paid orders in the last 14 days.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H + CHART_PAD_BOTTOM}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Daily paid revenue for the last 14 days — peak day ${formatPrice(peak)}`}
          >
            {metrics.series.map((point, index) => {
              const height = point.revenue === 0 ? 0 : Math.max((point.revenue / peak) * CHART_H, 3);
              const x = index * BAR_SLOT + 4;
              const y = CHART_H - height;
              return (
                <g key={point.date}>
                  {point.revenue > 0 && (
                    <rect x={x} y={y} width={BAR_W} height={height} rx="3" className="fill-sage">
                      <title>{point.date}: {formatPrice(point.revenue)}</title>
                    </rect>
                  )}
                  {(index % 2 === 0 || index === metrics.series.length - 1) && (
                    <text
                      x={x + BAR_W / 2}
                      y={CHART_H + 16}
                      textAnchor="middle"
                      fontSize="10"
                      className="fill-muted font-body"
                    >
                      {point.date.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} strokeWidth="1" className="stroke-border" />
          </svg>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Orders by status */}
        <section className="bg-sage-light rounded-[var(--radius-surface)] p-6">
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
            Orders by status
          </h2>
          <div className="space-y-3">
            {metrics.ordersByStatus.map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-body text-small text-charcoal">{row.status}</span>
                <span className="flex-1 h-3 rounded bg-cream overflow-hidden">
                  <span
                    className="block h-full bg-sage rounded"
                    style={{ width: `${(row.count / statusMax) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-body text-small text-charcoal">{row.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Low stock */}
        <section className="bg-sage-light rounded-[var(--radius-surface)] p-6">
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
            Low stock
          </h2>
          {metrics.lowStockList.length === 0 ? (
            <p className="font-body text-body text-muted">Everything is above {LOW_STOCK_THRESHOLD} in stock.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.lowStockList.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/products/${row.product.id}`}
                    className="font-body text-small text-charcoal hover:text-sage underline-offset-2 hover:underline"
                  >
                    {row.product.name} — {row.name}
                  </Link>
                  <span
                    className={`font-body text-small font-semibold ${
                      row.stock === 0 ? "text-error" : "text-warning"
                    }`}
                  >
                    {row.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent orders */}
      <section className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
            Recent orders
          </h2>
          <Link href="/admin/orders" className="font-body text-small text-sage underline">
            View all
          </Link>
        </div>
        {metrics.recentOrders.length === 0 ? (
          <p className="font-body text-body text-muted">No orders yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {metrics.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-cream/60 -mx-2 px-2"
              >
                <span className="font-body text-small text-charcoal">
                  #{order.orderNumber} · {formatPrice(order.total)} · {formatDate(order.createdAt)}
                </span>
                <span className="font-body text-small text-muted">
                  {order.orderStatus} · {order.paymentStatus}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-muted">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-h3 text-charcoal mt-2">{value}</p>
      <p className="font-body text-small text-muted mt-1">{hint}</p>
    </>
  );
  const className =
    "bg-sage-light rounded-[var(--radius-surface)] p-5 hover:bg-sage-light/70 transition-colors";
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
