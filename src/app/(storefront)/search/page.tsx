import { getProducts, paginate, normalizePage } from "@/modules/catalog";
import type { SortOption } from "@/modules/catalog";
import type { Metadata } from "next";
import Link from "next/link";
import { getWishlistProductIds } from "@/modules/wishlist";
import { ProductCard } from "@/components/storefront/ProductCard";
import { SortSelect } from "@/components/storefront/SortSelect";
import { Pagination } from "@/components/storefront/Pagination";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

// Phase 17: thin, query-driven results pages must not compete with /shop in
// the index (also listed in robots.txt).
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: false } };

type SearchPageProps = {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStockOnly?: string;
    page?: string;
  }>;
};

// Phase 15 (decision ③): the header/mobile search form posts here — a
// dedicated results page. Products only (no orders/users), and every value
// still flows through getProducts → sanitizeFilters, so nothing raw reaches
// the query. /shop keeps its inline search + full filter set.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.search === "string" ? params.search.trim() : "";

  const [allProducts, wishedIds] = await Promise.all([
    getProducts({
      search: query || undefined,
      sort: params.sort as SortOption | undefined,
      minPrice: params.minPrice ? Number(params.minPrice) * 100 : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) * 100 : undefined,
      inStockOnly: params.inStockOnly === "true",
    }),
    getWishlistProductIds(),
  ]);
  const wished = new Set(wishedIds);
  // ONE template expression: React SSR splits adjacent text nodes with
  // <!-- --> comments, which would break exact-string assertions.
  // The label counts the TOTAL matches (not just the current page's slice).
  const countLabel = `${allProducts.length} ${allProducts.length === 1 ? "product" : "products"}${
    query ? ` matching "${query}"` : ""
  }`;
  const { items: products, page: currentPage, totalPages } = paginate(
    allProducts,
    normalizePage(params.page)
  );

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        {query ? `Results for "${query}"` : "Search"}
      </h1>
      <p className="font-body text-body text-muted text-center mt-4" aria-live="polite">
        {countLabel}
      </p>

      <form method="GET" action="/search" className="mt-8 max-w-[500px] mx-auto">
        <label htmlFor="search-page-input" className="sr-only">
          Search products
        </label>
        <input
          id="search-page-input"
          type="search"
          name="search"
          defaultValue={query}
          placeholder="Search products"
          className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        />
      </form>

      <div className="flex justify-end mt-8">
        <SortSelect basePath="/search" />
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <h2 className="font-[family-name:var(--font-display)] text-h3 text-charcoal uppercase tracking-[0.04em]">
            No matches
          </h2>
          <p className="font-body text-body text-muted mt-4">
            {query
              ? `We couldn't find anything for "${query}".`
              : "Try a different word, or browse the shop."}
          </p>
          <div className="mt-6">
            <Link
              href="/search"
              className="inline-block h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold uppercase tracking-[0.02em] hover:bg-charcoal transition-colors"
            >
              Clear Search
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              wishlisted={wished.has(product.id)}
            />
          ))}
        </div>
      )}
      <Pagination basePath="/search" params={params} page={currentPage} totalPages={totalPages} />
    </div>
  );
}
