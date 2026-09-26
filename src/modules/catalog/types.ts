export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  mainImageUrl: string | null;
  startingPrice: number; // lowest variation price, in paisa
  isOutOfStock: boolean; // true only when EVERY variation is unavailable
  // Phase 10: approved-review rating (null/0 when nothing is approved yet).
  ratingAverage: number | null;
  ratingCount: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: { url: string; sortOrder: number }[];
  variations: {
    id: string;
    name: string;
    price: number;
    stock: number;
    isEnabled: boolean;
  }[];
  category: { name: string; slug: string };
};

export type SortOption = "featured" | "price-asc" | "price-desc" | "newest";

export type ProductFilters = {
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
};
