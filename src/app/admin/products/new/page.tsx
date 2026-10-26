import { getAdminCategories } from "@/modules/admin";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return (
    <div>
      <p className="ax-eyebrow">
        <span className="ax-eyebrow-line" aria-hidden="true" />
        CATALOG · NEW PIECE
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Add Product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
