import type { DailyRevenuePoint } from "./types";

// Phase 13 dashboard tuning — one place so the chart, the KPI cards and the
// low-stock list can never disagree about the window or the threshold.
export const LOW_STOCK_THRESHOLD = 3;
export const KPI_WINDOW_DAYS = 30;
export const CHART_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

// Day bucketing for money/reporting must match the store's timezone (the
// same reason formatDate pins Asia/Karachi): a UTC deployment would
// otherwise split "today" for a PK visitor. en-CA formats as YYYY-MM-DD so
// the key is directly comparable and sortable.
const DAY_LABEL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date: Date): string {
  return DAY_LABEL.format(date);
}

/**
 * Zero-filled daily PAID-revenue series for the last `CHART_DAYS` days,
 * oldest → newest, bucketed in Asia/Karachi. Pure (fixed `now`) so unit
 * tests can pin the dates; non-PAID rows are dropped here so the query can
 * hand over a raw window without pre-filtering. Orders whose Karachi day
 * falls outside the labelled window (the fetch buffer) are ignored.
 */
export function buildDailyRevenueSeries(
  orders: { createdAt: Date; total: number; paymentStatus: string }[],
  now: Date
): DailyRevenuePoint[] {
  const labels: string[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    labels.push(dayKey(new Date(now.getTime() - i * DAY_MS)));
  }

  const revenueByDay = new Map<string, number>(labels.map((label) => [label, 0]));
  for (const order of orders) {
    if (order.paymentStatus !== "PAID") continue;
    const key = dayKey(order.createdAt);
    const running = revenueByDay.get(key);
    if (running !== undefined) revenueByDay.set(key, running + order.total);
  }

  return labels.map((date) => ({ date, revenue: revenueByDay.get(date) ?? 0 }));
}
