import Link from "next/link";
import { getDashboardMetrics } from "@/modules/admin";
import { formatPrice, formatDate } from "@/lib/format";

// Phase 13: real dashboard (was a 3-line stub). Everything renders on the
// server — the revenue chart is plain SVG, zero client JS, design tokens
// only. Metrics come from one bounded read (getDashboardMetrics).
// Visual pass: same data, same markup obligations (role="img", aria-label,
// <title> per bar, empty state) — only the shell classes changed.
const CHART_W = 700;
const CHART_H = 170;
const CHART_PAD_BOTTOM = 26;
const BAR_SLOT = CHART_W / 14;
const BAR_W = BAR_SLOT - 8;

export default async function AdminDashboard() {
  const metrics = await getDashboardMetrics();
  const peak = Math.max(...metrics.series.map((point) => point.revenue), 0);
  const chartTotal = metrics.series.reduce((sum, point) => sum + point.revenue, 0);
  const statusMax = Math.max(...metrics.ordersByStatus.map((row) => row.count), 1);
  const statusTotal = metrics.ordersByStatus.reduce((sum, row) => sum + row.count, 0);
  const leadStatus = metrics.ordersByStatus.reduce(
    (best, row) => (row.count > best.count ? row : best),
    metrics.ordersByStatus[0] ?? { status: "—", count: 0 }
  );

  return (
    <div>
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            OVERVIEW · LAST 30 DAYS
          </p>
          <h1 className="ax-title">
            Dashboard<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">Store at a glance — updated on every page load.</p>
        </div>
        <p className="ax-meta">
          <span className="ax-live-mark" aria-hidden="true" />
          LIVE READ · ASIA/KARACHI
        </p>
      </div>

      {/* KPI cards */}
      <div className="ax-stats">
        <KpiCard
          label="Revenue · 30d"
          value={formatPrice(metrics.revenue30)}
          hint="Paid orders only"
          accent
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6" width="18" height="12" rx="2.5" />
              <circle cx="12" cy="12" r="2.6" />
              <path d="M6.5 9.5v5M17.5 9.5v5" />
            </svg>
          }
        />
        <KpiCard
          label="Orders · 30d"
          value={String(metrics.orders30)}
          hint="All statuses"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z" />
              <path d="M9 8V6.4A3 3 0 0 1 12 3.4a3 3 0 0 1 3 3V8" />
            </svg>
          }
        />
        <KpiCard
          label="New customers · 30d"
          value={String(metrics.customers30)}
          hint="Accounts created"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10" cy="8.5" r="3.4" />
              <path d="M4 19.6c.7-3.3 3.1-5.1 6-5.1s5.3 1.8 6 5.1" />
              <path d="M18.5 7v5M16 9.5h5" />
            </svg>
          }
        />
        <KpiCard
          label="Pending reviews · queue"
          value={String(metrics.pendingReviews)}
          hint="Awaiting moderation"
          href="/admin/reviews?status=PENDING"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
            </svg>
          }
        />
      </div>

      <div className="ax-grid">
        {/* 14-day revenue chart — server-rendered SVG */}
        <section className="ax-panel ax-panel--body">
          <div className="ax-panel-head">
            <div>
              <p className="ax-kicker">REVENUE</p>
              <h2 className="ax-h2">
                Last 14 days <span>· paid orders</span>
              </h2>
            </div>
            <Link href="/admin/orders" className="ax-round-link" aria-label="Open all orders">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </Link>
          </div>

          <div className="ax-chart-summary">
            <strong>{formatPrice(chartTotal)}</strong>
            <span className="ax-chart-chip">
              <i aria-hidden="true" />
              peak {formatPrice(peak)}
            </span>
          </div>

          {peak === 0 ? (
            <p className="ax-sub">No paid orders in the last 14 days.</p>
          ) : (
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H + CHART_PAD_BOTTOM}`}
              className="w-full h-auto"
              role="img"
              aria-label={`Daily paid revenue for the last 14 days — peak day ${formatPrice(peak)}`}
            >
              <defs>
                <linearGradient id="axBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7d957c" />
                  <stop offset="100%" stopColor="#5d7b62" />
                </linearGradient>
              </defs>
              {metrics.series.map((point, index) => {
                const height = point.revenue === 0 ? 0 : Math.max((point.revenue / peak) * CHART_H, 3);
                const x = index * BAR_SLOT + 4;
                const y = CHART_H - height;
                return (
                  <g key={point.date}>
                    {point.revenue > 0 && (
                      <rect x={x} y={y} width={BAR_W} height={height} rx="3" fill="url(#axBarFill)">
                        <title>{point.date}: {formatPrice(point.revenue)}</title>
                      </rect>
                    )}
                    {(index % 2 === 0 || index === metrics.series.length - 1) && (
                      <text
                        x={x + BAR_W / 2}
                        y={CHART_H + 16}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#9aa395"
                      >
                        {point.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} strokeWidth="1" stroke="#e6e9de" />
            </svg>
          )}

          <p className="ax-chart-legend">
            <span>
              <i className="ax-legend-swatch" aria-hidden="true" />
              Daily paid revenue
            </span>
            <span>{metrics.series.length} days</span>
          </p>
        </section>

        <section className="ax-panel ax-panel--soft">
          <div>
            <p className="ax-kicker">FULFILMENT</p>
            <h2 className="ax-h2">Orders by status</h2>
          </div>

          <p className="ax-status-total">
            <strong>{statusTotal}</strong>
            <span>orders in the book</span>
          </p>

          <div className="ax-status-list">
            {metrics.ordersByStatus.map((row) => (
              <div
                key={row.status}
                className={`ax-status-row${row.status === leadStatus.status ? " ax-status-row--lead" : ""}`}
              >
                <span className="ax-status-name">
                  <span
                    className={`ax-status-dot ax-status-dot--${row.status}`}
                    aria-hidden="true"
                  />
                  {row.status}
                </span>
                <span className="ax-progress-track">
                  <span style={{ width: `${(row.count / statusMax) * 100}%` }} />
                </span>
                <span className="ax-status-number">{row.count}</span>
              </div>
            ))}
          </div>

          <p className="ax-status-footnote">
            <i aria-hidden="true">✦</i>
            Every status in the book, counted on load.
          </p>
        </section>
      </div>

      {/* Recent orders */}
      <section className="ax-panel ax-panel--body">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">ACTIVITY</p>
            <h2>Recent orders</h2>
          </div>
          <Link href="/admin/orders" className="ax-text-link">
            View all
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
            </svg>
          </Link>
        </div>

        {metrics.recentOrders.length === 0 ? (
          <p className="ax-sub">No orders yet.</p>
        ) : (
          <div className="ax-table-wrap">
            <table className="ax-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payment</th>
                  <th scope="col" className="ax-amount">Total</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="ax-cell-strong">#{order.orderNumber}</span>
                      <span className="ax-cell-sub">{order.id.slice(0, 8)}</span>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className="ax-pill">
                        <i aria-hidden="true" />
                        {order.orderStatus}
                      </span>
                    </td>
                    <td>{order.paymentStatus}</td>
                    <td className="ax-amount">{formatPrice(order.total)}</td>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="ax-open-link"
                        aria-label={`Open order ${order.orderNumber}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 17 17 7M9 7h8v8" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="ax-footer">
        <span>
          <span className="ax-footer-leaf" aria-hidden="true">
            ✿
          </span>
          Girah admin
        </span>
        <span>
          30-day KPIs <i aria-hidden="true" /> 14-day chart <i aria-hidden="true" /> Asia/Karachi
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  const body = (
    <>
      <span className="ax-stat-top">
        <span className="ax-stat-label">{label}</span>
        <span className="ax-stat-icon">{icon}</span>
      </span>
      <span className="ax-stat-value">{value}</span>
      <span className="ax-stat-foot">
        <span className="ax-tiny-status">{hint}</span>
        <span className="ax-spark" aria-hidden="true">
          ✦
        </span>
      </span>
    </>
  );
  const className = `ax-stat${accent ? " ax-stat--accent" : ""}${href ? " ax-stat--linked" : ""}`;
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
