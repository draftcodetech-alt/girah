import { db } from "@/lib/db";
import type { ProductListItem, ProductDetail, ProductFilters, SortOption } from "./types";

const ALLOWED_SORTS: SortOption[] = ["featured", "price-asc", "price-desc", "newest"];

// Whitelists and clamps every incoming filter value — never trusts raw query-string
// input directly into a database query.
function sanitizeFilters(raw: ProductFilters): ProductFilters {
  const sort: SortOption = ALLOWED_SORTS.includes(raw.sort as SortOption)
    ? (raw.sort as SortOption)
    : "featured";

  const search =
    typeof raw.search === "string" ? raw.search.trim().slice(0, 100) : undefined;

  // Phase 5 float-price fix: callers do `Number(param) * 100`, which for
  // values like 8.3 yields 830.0000000000001 — a float paisa that silently
  // mis-filters integer prices (830 >= 830.000…1 is false). Round to whole
  // paisa here, the single choke point every price filter passes through.
  const toPaisa = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? Math.round(value)
      : undefined;

  const minPrice = toPaisa(raw.minPrice);
  const maxPrice = toPaisa(raw.maxPrice);

  return {
    categorySlug: typeof raw.categorySlug === "string" ? raw.categorySlug : undefined,
    search,
    minPrice,
    maxPrice,
    inStockOnly: raw.inStockOnly === true,
    sort,
  };
}

export async function getProducts(rawFilters: ProductFilters = {}): Promise<ProductListItem[]> {
  const filters = sanitizeFilters(rawFilters);

  const products = await db.product.findMany({
    where: {
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
              { category: { name: { contains: filters.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variations: true,
      // Phase 10 card ratings: APPROVED only — pending/rejected must never
      // leak into shop/homepage averages.
      reviews: { where: { status: "APPROVED" }, select: { rating: true } },
    },
    orderBy:
      filters.sort === "newest"
        ? { createdAt: "desc" }
        : { createdAt: "asc" }, // "featured" has no admin-controlled flag yet — falls back to catalog order
  });

  let items: ProductListItem[] = products.map((p) => {
    const enabledVariations = p.variations.filter((v) => v.isEnabled);
    const prices = enabledVariations.map((v) => v.price);
    const startingPrice = prices.length > 0 ? Math.min(...prices) : 0;
    // Out of stock ONLY when every variation is unavailable — not per-variation.
    const isOutOfStock =
      p.variations.length > 0 && p.variations.every((v) => !v.isEnabled || v.stock <= 0);

    const approvedRatings = p.reviews.map((review) => review.rating);
    const ratingCount = approvedRatings.length;
    const ratingAverage =
      ratingCount > 0
        ? Math.round((approvedRatings.reduce((sum, rating) => sum + rating, 0) / ratingCount) * 10) / 10
        : null;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      mainImageUrl: p.images[0]?.url ?? null,
      startingPrice,
      isOutOfStock,
      ratingAverage,
      ratingCount,
    };
  });

  if (filters.minPrice !== undefined) {
    items = items.filter((i) => i.startingPrice >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    items = items.filter((i) => i.startingPrice <= filters.maxPrice!);
  }
  if (filters.inStockOnly) {
    items = items.filter((i) => !i.isOutOfStock);
  }
  if (filters.sort === "price-asc") {
    items = items.sort((a, b) => a.startingPrice - b.startingPrice);
  }
  if (filters.sort === "price-desc") {
    items = items.sort((a, b) => b.startingPrice - a.startingPrice);
  }

  return items;
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variations: true,
      category: true,
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    images: product.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
    variations: product.variations.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      stock: v.stock,
      isEnabled: v.isEnabled,
    })),
    category: { name: product.category.name, slug: product.category.slug },
  };
}

export async function getCategories() {
  return db.category.findMany({ orderBy: { name: "asc" } });
}
