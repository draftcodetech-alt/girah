import { getAdminCategoriesWithCounts } from "@/modules/admin";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { CategoryRow } from "@/components/admin/CategoryRow";

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategoriesWithCounts();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">
        Categories
      </h1>

      <section aria-labelledby="add-category-heading" className="mb-8">
        <h2
          id="add-category-heading"
          className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-3"
        >
          Add category
        </h2>
        <CategoryForm />
      </section>

      {categories.length === 0 ? (
        <p className="font-body text-body text-muted">No categories yet — add the first one.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
