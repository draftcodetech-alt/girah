import { getProducts, getCategories } from "@/modules/catalog";
import type { SortOption } from "@/modules/catalog";
import { ProductCard } from "@/components/storefront/ProductCard";
import { CategoryTabs } from "@/components/storefront/CategoryTabs";
import { SortSelect } from "@/components/storefront/SortSelect";
import { ShopFilters } from "@/components/storefront/ShopFilters";

type ShopPageProps = {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStockOnly?: string;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const categories = await getCategories();

  const products = await getProducts({
    categorySlug: params.category,
    search: params.search,
    sort: params.sort as SortOption | undefined,
    minPrice: params.minPrice ? Number(params.minPrice) * 100 : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) * 100 : undefined,
    inStockOnly: params.inStockOnly === "true",
  });

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Shop
      </h1>
      <p className="font-body text-body text-muted text-center mt-4 max-w-[500px] mx-auto">
        Discover pieces made by hand, with care in every stitch.
      </p>

      <div className="mt-6">
        <CategoryTabs categories={categories} activeSlug={params.category} searchParams={params} />
      </div>

      <div className="flex gap-12 mt-8 items-start">
        <ShopFilters />

        <div className="flex-1">
          <form method="GET" action="/shop">
            {params.category && <input type="hidden" name="category" value={params.category} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {/* Phase 5: searching must not wipe the price/stock filters either */}
            {params.minPrice && <input type="hidden" name="minPrice" value={params.minPrice} />}
            {params.maxPrice && <input type="hidden" name="maxPrice" value={params.maxPrice} />}
            {params.inStockOnly && <input type="hidden" name="inStockOnly" value={params.inStockOnly} />}
            <input
              type="search"
              name="search"
              defaultValue={params.search ?? ""}
              placeholder="Search products"
              className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
            />
          </form>

          <div className="flex justify-end mt-8">
            <SortSelect />
          </div>

          {products.length === 0 ? (
            <div className="text-center py-24">
              <h2 className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
                {params.search ? "No matches" : "Nothing here"}
              </h2>
              <p className="font-body text-body text-muted mt-4">
                {params.search
                  ? `We couldn't find anything for "${params.search}".`
                  : "Try adjusting your filters to find a piece."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}