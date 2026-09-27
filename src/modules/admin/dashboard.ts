"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { buildDailyRevenueSeries, CHART_DAYS, KPI_WINDOW_DAYS, LOW_STOCK_THRESHOLD } from "./dashboard-ops";
import type { DashboardMetrics } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const ALL_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

/**
 * Phase 13: one bounded read per KPI (never "fetch everything, sum in the
 * page"). Aggregations stay in Prisma (`aggregate`/`count`/`groupBy`) and
 * only the 14-day revenue series is bucketed in JS — day boundaries must be
 * Asia/Karachi, which SQL `date_trunc` would do in the DB timezone.
 * `requireAdmin` first, like every admin query in this module.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requireAdmin();

  const now = new Date();
  const kpiSince = new Date(now.getTime() - KPI_WINDOW_DAYS * DAY_MS);
  // +1 day buffer: an order from the early hours of the oldest label day
  // (Karachi) can still be inside the UTC window — the series drops
  // anything outside the labelled range, so over-fetching is safe.
  const chartSince = new Date(now.getTime() - (CHART_DAYS + 1) * DAY_MS);

  const [
    revenueAgg,
    orders30,
    customers30,
    pendingReviews,
    lowStockCount,
    chartOrders,
    statusGroups,
    lowStockList,
    recentOrders,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: kpiSince }, paymentStatus: "PAID" },
    }),
    db.order.count({ where: { createdAt: { gte: kpiSince } } }),
    db.user.count({ where: { createdAt: { gte: kpiSince } } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.productVariation.count({ where: { isEnabled: true, stock: { lte: LOW_STOCK_THRESHOLD } } }),
    db.order.findMany({
      where: { createdAt: { gte: chartSince } },
      select: { createdAt: true, total: true, paymentStatus: true },
    }),
    db.order.groupBy({ by: ["orderStatus"], _count: { _all: true } }),
    db.productVariation.findMany({
      where: { isEnabled: true, stock: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stock: "asc" },
      take: 8,
      include: { product: { select: { id: true, name: true, slug: true } } },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
  ]);

  const countsByStatus = new Map<string, number>(
    statusGroups.map((group) => [group.orderStatus as string, group._count._all])
  );

  return {
    revenue30: revenueAgg._sum.total ?? 0,
    orders30,
    customers30,
    pendingReviews,
    lowStockCount,
    series: buildDailyRevenueSeries(chartOrders, now),
    ordersByStatus: ALL_ORDER_STATUSES.map((status) => ({ status, count: countsByStatus.get(status) ?? 0 })),
    lowStockList: lowStockList.map((row) => ({
      id: row.id,
      name: row.name,
      stock: row.stock,
      product: row.product,
    })),
    recentOrders,
  };
}
