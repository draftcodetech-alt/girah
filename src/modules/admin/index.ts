
export { getAdminCustomers, getAdminCustomerById, toggleCustomerActive } from "./customers";
export {
  getAdminProducts,
  getAdminProductById,
  getAdminCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products";
export { getAdminVariations, updateVariation, createVariation, adjustStock, getStockAdjustmentHistory } from "./variations";
export type { AdminActionResult } from "./products";
export type { ProductInput, VariationInput, CreateVariationInput, StockAdjustmentInput, CategoryInput } from "./schema";

export {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  markCodPaymentReceived,
  refundOrderPayment,
} from "./orders";
export type { AdminOrderFilters } from "./types";
export { getStockAdjustmentFeed } from "./stock";
export { getDashboardMetrics } from "./dashboard";
export { buildDailyRevenueSeries, LOW_STOCK_THRESHOLD } from "./dashboard-ops";
export type { DashboardMetrics, DailyRevenuePoint, StockFeedRow } from "./types";

export { getAdminReviews, setReviewStatus } from "./reviews";
export type { AdminReviewStatus } from "./reviews";

export { uploadProductImage, deleteProductImage, moveProductImage } from "./images";

export {
  getAdminCategoriesWithCounts,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories";
export type { CategoryActionResult } from "./categories";
