"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import type { StockFeedRow } from "./types";

/**
 * Phase 13: cross-product stock audit feed for /admin/stock — who changed
 * what, when and why (admin manual adjusts + cancel restocks in one list;
 * `adminId: null` rows are customer cancels). Newest first, capped at 200
 * so the page stays one bounded read.
 */
export async function getStockAdjustmentFeed(filters: { search?: string } = {}): Promise<StockFeedRow[]> {
  await requireAdmin();

  const search = filters.search?.trim();
  return db.stockAdjustment.findMany({
    where: search
      ? {
          OR: [
            { variation: { name: { contains: search, mode: "insensitive" } } },
            { variation: { product: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    include: {
      variation: { include: { product: { select: { id: true, name: true } } } },
      admin: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
