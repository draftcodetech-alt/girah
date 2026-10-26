
export { getAdminCustomers, getAdminCustomerById, toggleCustomerActive } from "./customers";
export {
  getAdminProducts,
  getAdminProductById,
  getAdminCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products";
export { getAdminVariations, updateVariation, createVariation } from "./variations";
export type { AdminActionResult } from "./products";
export type { ProductInput, VariationInput, CreateVariationInput, CategoryInput } from "./schema";

export {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  markCodPaymentReceived,
} from "./orders";
export type { AdminOrderFilters } from "./types";
export { getDashboardMetrics } from "./dashboard";
export { buildDailyRevenueSeries } from "./dashboard-ops";
export type { DashboardMetrics, DailyRevenuePoint } from "./types";

export { getAdminReviews, setReviewStatus } from "./reviews";
export type { AdminReviewStatus } from "./reviews";

export {
  uploadProductImage,
  deleteProductImage,
  moveProductImage,
  uploadVariationImage,
  deleteVariationImage,
  moveVariationImage,
} from "./images";

export {
  getAdminCategoriesWithCounts,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories";
export type { CategoryActionResult } from "./categories";
