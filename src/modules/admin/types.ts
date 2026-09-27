// Phase 13: shared admin types (filters + dashboard shapes).
// NOT a "use server" file: types must be importable anywhere, and a
// "use server" module may only export async functions. The pure series
// builder and tuning constants live in ./dashboard-ops (also plain).

export type AdminOrderFilters = {
  /** Exact orderStatus match; unknown strings are ignored (reviews pattern). */
  status?: string;
  /** Substring match on order number, customer name or email (case-insensitive). */
  search?: string;
};

export type DailyRevenuePoint = { date: string; revenue: number };

export type DashboardMetrics = {
  /** Σ totals of PAID orders in the last 30 days (PENDING/FAILED/REFUNDED excluded). */
  revenue30: number;
  orders30: number;
  customers30: number;
  pendingReviews: number;
  lowStockCount: number;
  /** Zero-filled daily PAID revenue for the last 14 days (Asia/Karachi days). */
  series: DailyRevenuePoint[];
  ordersByStatus: { status: string; count: number }[];
  lowStockList: {
    id: string;
    name: string;
    stock: number;
    product: { id: string; name: string; slug: string };
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    createdAt: Date;
  }[];
};

export type StockFeedRow = {
  id: string;
  variationId: string;
  previousStock: number;
  adjustment: number;
  newStock: number;
  reason: string;
  adminId: string | null;
  createdAt: Date;
  admin: { name: string; email: string } | null;
  variation: {
    id: string;
    name: string;
    product: { id: string; name: string };
  };
};
