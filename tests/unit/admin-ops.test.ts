import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildDailyRevenueSeries,
  dayKey,
  CHART_DAYS,
  KPI_WINDOW_DAYS,
} from "@/modules/admin/dashboard-ops";

// Phase 13 (admin ops & dashboard): pure series logic + source guards for
// dashboard aggregation policy, order actions and the merged Catalog page.
// (The standalone Refund, the stock feed and the stock nav were removed as
// spec changes — see delaytest.md.)

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
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

  it("keeps the documented windows", () => {
    expect(CHART_DAYS).toBe(14);
    expect(KPI_WINDOW_DAYS).toBe(30);
    expect(ops).toContain('const DAY_MS = 24 * 60 * 60 * 1000;');
  });

  it("pins the reporting timezone to Asia/Karachi", () => {
    expect(ops).toContain('timeZone: "Asia/Karachi"');
    expect(ops).toContain('"en-CA"');
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

  it("caps the heavy lists (recent orders 8)", () => {
    const takes = dashboard.match(/take: 8,/g) ?? [];
    expect(takes).toHaveLength(1);
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
    expect(page).toContain('href="/admin/orders"');
    expect(page).toContain("/admin/orders/${"); // recent orders → detail
  });
});

describe("Phase 13: order UI guards (source)", () => {
  const actions = readSource("src/components/admin/OrderActions.tsx");
  const row = readSource("src/components/admin/AdminOrderRow.tsx");
  const detail = readSource("src/app/admin/orders/[id]/page.tsx");
  const list = readSource("src/app/admin/orders/page.tsx");

  it("has no standalone Refund control (spec change): status select + Mark Paid only", () => {
    expect(actions).not.toContain("refundOrderPayment");
    expect(actions).not.toContain("allowRefund");
    expect(actions).not.toContain("confirmingRefund");
    expect(actions).not.toContain("formatPrice");
  });

  it("lays the controls out as one gap-separated flex row (compact included)", () => {
    expect(actions).toContain('"flex flex-wrap items-center gap-3"');
    expect(actions).toContain('"flex flex-wrap items-center gap-4"');
    expect(actions).not.toContain('compact ? ""');
  });

  it("surfaces action failures in role=alert and restores optimistic status", () => {
    expect(actions).toContain('role="alert"');
    expect(actions).toContain("setStatus(previousStatus)");
    expect(actions).toContain('setError(result.error)');
  });

  it("routes the list row and detail page through the shared OrderActions", () => {
    expect(row).toContain("OrderActions");
    expect(row).not.toContain("allowRefund");
    expect(detail).toContain("<OrderActions order={order} />");
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

describe("admin nav + catalog merge (source)", () => {
  const layout = readSource("src/app/admin/layout.tsx");

  it("nav exposes ONE Catalog entry (products/categories/variations/stock merged)", () => {
    expect(layout).toContain('{ href: "/admin/catalog", label: "Catalog" }');
    for (const gone of ["/admin/products", "/admin/categories", "/admin/variations", "/admin/stock"]) {
      expect(layout).not.toContain(`{ href: "${gone}"`);
    }
  });

  it("the four old index routes redirect to the catalog", () => {
    for (const section of ["products", "categories", "variations", "stock"]) {
      const page = readSource(`src/app/admin/${section}/page.tsx`);
      expect(page).toContain('redirect("/admin/catalog")');
    }
  });

  it("catalog page shows products and categories together with the add-product entry point", () => {
    const catalog = readSource("src/app/admin/catalog/page.tsx");
    expect(catalog).toContain("getAdminProducts");
    expect(catalog).toContain("getAdminCategoriesWithCounts");
    expect(catalog).toContain("CatalogProductRow");
    expect(catalog).toContain('href="/admin/products/new"');
    expect(catalog).not.toContain('"use client"');
  });

  it("catalog rows expand into the product form, variations and the image workflow", () => {
    const row = readSource("src/components/admin/CatalogProductRow.tsx");
    expect(row.startsWith('"use client";')).toBe(true);
    expect(row).toContain("ProductForm");
    expect(row).toContain("VariationRow");
    expect(row).toContain("VariationForm");
    expect(row).toContain("/admin/products/${product.id}"); // images deep link
  });

  it("the stock concept is gone from the schema", () => {
    const schema = readSource("prisma/schema.prisma");
    expect(schema).not.toContain("StockAdjustment");
    expect(schema).not.toMatch(/^\s*stock\s+Int/m);
  });
});
