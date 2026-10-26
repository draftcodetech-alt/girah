import { getProducts, getCategories, paginate, normalizePage } from "@/modules/catalog";
import type { SortOption } from "@/modules/catalog";
import type { Metadata } from "next";
import Link from "next/link";
import { getWishlistProductIds } from "@/modules/wishlist";
import { ProductCard } from "@/components/storefront/ProductCard";
import { CategoryTabs } from "@/components/storefront/CategoryTabs";
import { SortSelect } from "@/components/storefront/SortSelect";
import { ShopFilters } from "@/components/storefront/ShopFilters";
import { Pagination } from "@/components/storefront/Pagination";

export const metadata: Metadata = { title: "Shop" };
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

type ShopPageProps = {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const categories = await getCategories();

  // Public sort list is price-only (by request): Featured/Newest were removed
  // from the UI, so anything else normalizes to price-asc — the same rule
  // SortSelect applies, keeping the displayed sort and the real order in sync.
  const sort: SortOption = params.sort === "price-desc" ? "price-desc" : "price-asc";

  const allProducts = await getProducts({
    categorySlug: params.category,
    search: params.search,
    sort,
    minPrice: params.minPrice ? Number(params.minPrice) * 100 : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) * 100 : undefined,
  });
  const { items: products, page: currentPage, totalPages } = paginate(
    allProducts,
    normalizePage(params.page)
  );
  const wished = new Set(await getWishlistProductIds());

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${appUrl}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${appUrl}/shop` },
    ],
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Visually removed per spec: the breadcrumb already names the page.
          Kept sr-only so the page keeps exactly one h1 for a11y/SEO. */}
      <h1 className="sr-only">Shop</h1>

      <div className="mt-6">
        <CategoryTabs categories={categories} activeSlug={params.category} searchParams={params} />
      </div>

      {/* Stacked below lg: the mobile Filters button must sit ABOVE the
         content, not beside it — as a row sibling it squeezed the grid
         (and the cards in it) to ~225px and overflowed the viewport. */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 mt-8 items-start">
        <ShopFilters />

        {/* w-full: the column flex uses items-start, which would otherwise
            shrink-to-fit this column instead of stretching it. */}
        <div className="flex-1 w-full">
          <form method="GET" action="/shop">
            {params.category && <input type="hidden" name="category" value={params.category} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {/* Phase 5: searching must not wipe the price filters either */}
            {params.minPrice && <input type="hidden" name="minPrice" value={params.minPrice} />}
            {params.maxPrice && <input type="hidden" name="maxPrice" value={params.maxPrice} />}
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

          {/* Result count + active-filter chips (all real query state — every
              chip deep-links to the same list minus itself). */}
          <div className="flex flex-wrap items-center gap-2 mt-4" aria-live="polite">
            <span className="font-body text-small text-muted">
              {products.length === 0
                ? "No pieces"
                : `${allProducts.length} ${allProducts.length === 1 ? "piece" : "pieces"}`}
            </span>
            {(() => {
              const chips: { label: string; href: string }[] = [];
              const without = (drop: string[]) => {
                const p = new URLSearchParams();
                if (params.category && !drop.includes("category")) p.set("category", params.category);
                if (params.search && !drop.includes("search")) p.set("search", params.search);
                if (params.sort && !drop.includes("sort")) p.set("sort", params.sort);
                if (params.minPrice && !drop.includes("minPrice")) p.set("minPrice", params.minPrice);
                if (params.maxPrice && !drop.includes("maxPrice")) p.set("maxPrice", params.maxPrice);
                const qs = p.toString();
                return `/shop${qs ? `?${qs}` : ""}`;
              };
              const activeCategory = categories.find((c) => c.slug === params.category);
              if (activeCategory) chips.push({ label: activeCategory.name, href: without(["category"]) });
              // Chips echo raw params — only finite numbers (garbage like
              // ?minPrice=Infinity must never render "Rs. Infinity").
              if (params.search) chips.push({ label: `“${params.search}”`, href: without(["search"]) });
              if (params.minPrice && Number.isFinite(Number(params.minPrice)))
                chips.push({ label: `Rs. ${params.minPrice}+`, href: without(["minPrice"]) });
              if (params.maxPrice && Number.isFinite(Number(params.maxPrice)))
                chips.push({ label: `Up to Rs. ${params.maxPrice}`, href: without(["maxPrice"]) });
              return chips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  aria-label={`Remove filter ${chip.label}`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-sage-light font-body text-small text-charcoal hover:bg-border transition-colors"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </Link>
              ));
            })()}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-24">
              <h2 className="font-[family-name:var(--font-display)] text-h3 text-charcoal uppercase tracking-[0.04em]">
                {params.search ? "No matches" : "Nothing here"}
              </h2>
              <p className="font-body text-body text-muted mt-4">
                {params.search
                  ? `We couldn't find anything for "${params.search}".`
                  : "Try adjusting your filters to find a piece."}
              </p>
              <div className="mt-6">
                <Link
                  href="/shop"
                  className="inline-block h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold uppercase tracking-[0.02em] hover:bg-charcoal transition-colors"
                >
                  {params.search ? "Clear Search" : "Clear Filters"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} wishlisted={wished.has(product.id)} priority={i === 0} />
              ))}
            </div>
          )}
          <Pagination basePath="/shop" params={params} page={currentPage} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}