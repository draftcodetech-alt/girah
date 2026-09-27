import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildDailyRevenueSeries,
  dayKey,
  CHART_DAYS,
  KPI_WINDOW_DAYS,
  LOW_STOCK_THRESHOLD,
} from "@/modules/admin/dashboard-ops";

// Phase 13 (admin ops & dashboard): pure series logic + source guards for
// refund ordering, dashboard aggregation policy, and the new pages.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function functionSource(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  return source.slice(start);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

// Fixed clock: noon UTC on 15 March 2026 = 17:00 Asia/Karachi on 15 March.
const NOW = new Date("2026-03-15T12:00:00Z");

function paid(createdAt: Date, total: number) {
  return { createdAt, total, paymentStatus: "PAID" };
}

describe("buildDailyRevenueSeries", () => {
  it("zero-fills all 14 days, oldest label first, even with no orders", () => {
    const series = buildDailyRevenueSeries([], NOW);
    expect(series).toHaveLength(CHART_DAYS);
    expect(series[0].date).toBe("2026-03-02");
    expect(series[13].date).toBe("2026-03-15");
    expect(series.every((point) => point.revenue === 0)).toBe(true);
  });

  it("drops non-PAID orders (PENDING/REFUNDED never count as revenue)", () => {
    const series = buildDailyRevenueSeries(
      [
        { createdAt: NOW, total: 700, paymentStatus: "PENDING" },
        { createdAt: NOW, total: 900, paymentStatus: "REFUNDED" },
        { createdAt: NOW, total: 500, paymentStatus: "FAILED" },
      ],
      NOW
    );
    expect(series[13].revenue).toBe(0);
  });

  it("accumulates same-day totals into one bucket", () => {
    const series = buildDailyRevenueSeries(
      [paid(NOW, 1_000), paid(NOW, 2_500), paid(new Date("2026-03-13T06:00:00Z"), 100)],
      NOW
    );
    expect(series[13].revenue).toBe(3_500); // 15 Mar
    expect(series[11].revenue).toBe(100); // 13 Mar
    expect(series[12].revenue).toBe(0); // 14 Mar stays empty
  });

  it("buckets by Asia/Karachi days, not UTC (late-UTC orders land on the PK date)", () => {
    expect(dayKey(NOW)).toBe("2026-03-15"); // 17:00 PKT same day
    // 21:00 UTC on 14 March = 02:00 PKT on 15 March → last PK bucket.
    const lateUtc = new Date("2026-03-14T21:00:00Z");
    expect(dayKey(lateUtc)).toBe("2026-03-15");
    const series = buildDailyRevenueSeries([paid(lateUtc, 42)], NOW);
    expect(series[13].revenue).toBe(42);
    expect(series[12].revenue).toBe(0); // 14 Mar bucket untouched
  });

  it("ignores orders outside the labelled window (query buffer rows)", () => {
    const series = buildDailyRevenueSeries([paid(new Date("2026-03-01T12:00:00Z"), 999)], NOW);
    expect(series.every((point) => point.revenue === 0)).toBe(true);
  });

  it("is pure: same inputs always produce the same labels", () => {
    const a = buildDailyRevenueSeries([], NOW);
    const b = buildDailyRevenueSeries([], NOW);
    expect(a.map((p) => p.date)).toEqual(b.map((p) => p.date));
  });
});

describe("Phase 13: dashboard tuning constants", () => {
  const ops = readSource("src/modules/admin/dashboard-ops.ts");

  it("keeps the documented windows and low-stock threshold", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(3);
    expect(CHART_DAYS).toBe(14);
    expect(KPI_WINDOW_DAYS).toBe(30);
    expect(ops).toContain('const DAY_MS = 24 * 60 * 60 * 1000;');
  });

  it("pins the reporting timezone to Asia/Karachi", () => {
    expect(ops).toContain('timeZone: "Asia/Karachi"');
    expect(ops).toContain('"en-CA"');
  });
});

describe("Phase 13: refund action guards (source)", () => {
  const orders = readSource("src/modules/admin/orders.ts");
  const refund = functionSource(orders, "export async function refundOrderPayment");

  it("calls the Safepay refund API BEFORE any state change", () => {
    const apiCall = refund.indexOf("await refundSafepayPayment(");
    const stateChange = refund.indexOf("await db.order.updateMany(");
    expect(apiCall).toBeGreaterThan(0);
    expect(stateChange).toBeGreaterThan(apiCall);
  });

  it("returns money-only: no restock and no audit row from the refund path", () => {
    expect(orders).not.toContain("db.productVariation");
    expect(orders).not.toContain("db.stockAdjustment");
    expect(refund).not.toContain("orderStatus:");
  });

  it("transitions with a CAS on PAID and a refusal message when it loses", () => {
    expect(refund).toContain('where: { id: orderId, paymentStatus: "PAID" }');
    expect(refund).toContain('data: { paymentStatus: "REFUNDED" }');
    expect(refund).toContain("Payment status changed — reload the page and try again.");
  });

  it("gates on requireAdmin first, then not-found / already-refunded / not-PAID", () => {
    expect(refund.indexOf("await requireAdmin()")).toBeGreaterThan(-1);
    expect(refund.indexOf("await requireAdmin()")).toBeLessThan(
      refund.indexOf("db.order.findUnique")
    );
    expect(refund.indexOf('error: "Order not found."')).toBeLessThan(
      refund.indexOf('error: "This payment has already been refunded."')
    );
    expect(refund.indexOf("this payment has already been refunded.")).toBeLessThan(
      refund.indexOf("Only a PAID payment can be refunded")
    );
  });

  it("keeps COD free of any Safepay call", () => {
    const safepayBlock = refund.slice(
      refund.indexOf('order.paymentMethod === "SAFEPAY"'),
      refund.indexOf("// CAS: another admin")
    );
    expect(safepayBlock).toContain("refundSafepayPayment");
    // refundSafepayPayment only appears inside the SAFEPAY branch (plus import).
    expect(refund.split("refundSafepayPayment").length - 1).toBe(1);
  });

  it("revalidates both the list and the detail page after a successful mutation", () => {
    expect(orders.match(/revalidatePath\(`\/admin\/orders\/\$\{orderId\}`\)/g)).toHaveLength(3);
    expect(orders).toContain('revalidatePath("/admin/orders")');
  });

  it("filters orders by exact known status and insensitive text search", () => {
    const list = functionSource(orders, "export async function getAdminOrders");
    expect(list).toContain(".includes(filters.status)");
    expect(list).toContain('contains: search, mode: "insensitive"');
    expect(list).toContain("customerEmail");
    expect(list).not.toContain("toInt(filters.status");
  });

  it("detail query joins the customer account for the profile link", () => {
    const detail = functionSource(orders, "export async function getAdminOrderById");
    expect(detail).toContain("user: { select: { id: true, name: true, email: true } }");
    expect(detail).toContain("items: true");
  });
});

describe("Phase 13: dashboard module guards (source)", () => {
  const dashboard = readSource("src/modules/admin/dashboard.ts");

  it('is a "use server" module exporting only the metrics action', () => {
    expect(dashboard.startsWith('"use server";')).toBe(true);
    const exports = dashboard.match(/^export .*$/gm) ?? [];
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatch(/^export async function getDashboardMetrics/);
    expect(dashboard).not.toContain("testAdminAction"); // Phase 12 POC removed
  });

  it("never leaves src/ with the removed POC anywhere", () => {
    const hits = walk(join(ROOT, "src")).filter((file) =>
      readFileSync(file, "utf8").includes("testAdminAction")
    );
    expect(hits).toEqual([]);
  });

  it("counts revenue as PAID-only inside the 30-day window", () => {
    expect(dashboard).toContain('paymentStatus: "PAID"');
    expect(dashboard).toContain("createdAt: { gte: kpiSince }");
    expect(dashboard).toContain("KPI_WINDOW_DAYS");
  });

  it("fetches the chart window with a +1 day buffer and aggregates status via groupBy", () => {
    expect(dashboard).toContain("(CHART_DAYS + 1) * DAY_MS");
    expect(dashboard).toContain('groupBy({ by: ["orderStatus"], _count: { _all: true } })');
  });

  it("caps the heavy lists (low stock 8, recent orders 8)", () => {
    const takes = dashboard.match(/take: 8,/g) ?? [];
    expect(takes).toHaveLength(2);
  });

  it("stays bounded: no unconstrained findMany on Order", () => {
    expect(dashboard).not.toMatch(/db\.order\.findMany\(\{\s*\}\)/);
    expect(dashboard).not.toContain("findMany({ orderBy: { createdAt: \"desc\" } })");
  });
});

describe("Phase 13: dashboard page guards (source)", () => {
  const page = readSource("src/app/admin/page.tsx");

  it("is a server component rendering an accessible SVG chart (no client JS)", () => {
    expect(page).not.toContain('"use client"');
    expect(page).toContain('role="img"');
    expect(page).toContain("aria-label=");
    expect(page).toContain("<title>");
    expect(page).toContain("No paid orders in the last 14 days.");
  });

  it("links the KPI cards and lists into the filtered pages", () => {
    expect(page).toContain('href="/admin/reviews?status=PENDING"');
    expect(page).toContain('href="/admin/stock"');
    expect(page).toContain('href="/admin/orders"');
    expect(page).toContain("/admin/orders/${"); // recent orders → detail
  });
});

describe("Phase 13: order UI guards (source)", () => {
  const actions = readSource("src/components/admin/OrderActions.tsx");
  const row = readSource("src/components/admin/AdminOrderRow.tsx");
  const detail = readSource("src/app/admin/orders/[id]/page.tsx");
  const list = readSource("src/app/admin/orders/page.tsx");

  it("shows Refund only on the detail page (allowRefund) and only while PAID, behind a two-step confirm", () => {
    expect(actions).toContain('paymentStatus === "PAID"');
    expect(actions).toContain("allowRefund && paymentStatus === \"PAID\"");
    expect(actions).toContain("allowRefund?: boolean");
    expect(actions).toContain("confirmingRefund");
    expect(actions).toContain("`Yes, refund ${formatPrice(order.total)}`");
    expect(actions).toContain("setConfirmingRefund(false)");
  });

  it("surfaces action failures in role=alert and restores optimistic status", () => {
    expect(actions).toContain('role="alert"');
    expect(actions).toContain("setStatus(previousStatus)");
    expect(actions).toContain('setError(result.error)');
  });

  it("routes the list row and detail page through the shared OrderActions", () => {
    expect(row).toContain("OrderActions");
    expect(row).not.toContain("allowRefund"); // list rows never offer the refund control
    expect(detail).toContain("<OrderActions order={order} allowRefund />");
    expect(row).toContain("/admin/orders/${order.id}"); // row number links to detail
    expect(detail).toContain("if (!order) notFound()");
  });

  it("orders list combines status tabs with search, each preserving the other", () => {
    expect(list).toContain("tabHref");
    expect(list).toContain("if (search) query.set(\"search\", search)");
    expect(list).toContain('<input type="hidden" name="status"');
    expect(list).toContain('aria-current={isActive ? "page" : undefined}');
    expect(list).toContain('method="GET"');
  });
});

describe("Phase 13: stock page + nav guards (source)", () => {
  const stock = readSource("src/app/admin/stock/page.tsx");
  const layout = readSource("src/app/admin/layout.tsx");
  const feed = readSource("src/modules/admin/stock.ts");

  it("adds Stock to the admin nav", () => {
    expect(layout).toContain('{ href: "/admin/stock", label: "Stock" }');
  });

  it("labels admin-less audit rows as customer cancels", () => {
    expect(stock).toContain("Customer (order cancel)");
    expect(stock).toContain("row.admin ? row.admin.email");
  });

  it("feed is admin-gated, newest-first, bounded and attribution-complete", () => {
    expect(feed.startsWith('"use server";')).toBe(true);
    expect(feed.indexOf("await requireAdmin()")).toBeLessThan(feed.indexOf("db.stockAdjustment"));
    expect(feed).toContain("orderBy: { createdAt: \"desc\" }");
    expect(feed).toContain("take: 200");
    expect(feed).toContain("admin: { select: { name: true, email: true } }");
    expect(feed).toContain("variation: { include: { product:");
  });

  it("feed search matches product OR variation names, case-insensitively", () => {
    const or = feed.indexOf("OR: [");
    expect(or).toBeGreaterThan(0);
    expect(feed).toContain('variation: { name: { contains: search, mode: "insensitive" } }');
    expect(feed).toContain('variation: { product: { name: { contains: search, mode: "insensitive" } } }');
    expect(feed.indexOf("admin: { select")).toBeGreaterThan(or);
  });
});
