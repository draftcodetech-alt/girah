import Link from "next/link";
import { getAdminProducts, getAdminCategoriesWithCounts } from "@/modules/admin";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { CategoryRow } from "@/components/admin/CategoryRow";
import { CatalogProductRow } from "@/components/admin/CatalogProductRow";

export const metadata = { title: "Catalog" };

/**
 * The single Catalog tab (owner spec): products, their categories and their
 * variations in ONE place. Products expand in place for editing + variation
 * management; categories get their own section below; per-product images
 * keep the dedicated /admin/products/[id] workflow (linked from each row).
 *
 * The old /admin/products, /admin/categories, /admin/variations and
 * /admin/stock index routes redirect here so no second UI exists.
 */
export default async function AdminCatalogPage() {
  const [products, categories] = await Promise.all([
    getAdminProducts(),
    getAdminCategoriesWithCounts(),
  ]);
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">Catalog</h1>
          <p className="font-body text-small text-muted mt-1">
            Products, categories and variations — all on one page.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
        >
          + Add Product
        </Link>
      </div>

      <section aria-labelledby="catalog-products-heading">
        <h2
          id="catalog-products-heading"
          className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-3"
        >
          Products ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className="font-body text-body text-muted">
            No products yet — add the first one.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {products.map((product) => (
              <CatalogProductRow
                key={product.id}
                product={product}
                categories={categoryOptions}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="catalog-categories-heading" className="mt-12">
        <h2
          id="catalog-categories-heading"
          className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-3"
        >
          Categories ({categories.length})
        </h2>

        <div className="mb-6">
          <h3 className="font-body text-small text-charcoal font-semibold mb-2">Add category</h3>
          <CategoryForm />
        </div>

        {categories.length === 0 ? (
          <p className="font-body text-body text-muted">
            No categories yet — add the first one.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
