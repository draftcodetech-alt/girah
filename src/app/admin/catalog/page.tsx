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
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            PRODUCTS · CATEGORIES · VARIATIONS
          </p>
          <h1 className="ax-title">
            Catalog<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">Products, categories and variations — all on one page.</p>
        </div>
        <Link href="/admin/products/new" className="ax-btn ax-btn--primary">
          + Add Product
        </Link>
      </div>

      <section aria-labelledby="catalog-products-heading" className="ax-panel ax-panel--body">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">INVENTORY</p>
            <h2 id="catalog-products-heading">Products ({products.length})</h2>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="ax-sub">No products yet — add the first one.</p>
        ) : (
          <div className="ax-rows">
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

      <section
        aria-labelledby="catalog-categories-heading"
        className="ax-panel ax-panel--body mt-6"
      >
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">TAXONOMY</p>
            <h2 id="catalog-categories-heading">Categories ({categories.length})</h2>
          </div>
        </div>

        <div className="ax-inline-panel">
          <h3 className="ax-form-label">Add category</h3>
          <CategoryForm />
        </div>

        {categories.length === 0 ? (
          <p className="ax-sub mt-6">No categories yet — add the first one.</p>
        ) : (
          <div className="ax-rows mt-6">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
