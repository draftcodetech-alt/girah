import { notFound } from "next/navigation";
import { getAdminProductById, getAdminCategories } from "@/modules/admin";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProductById(id), getAdminCategories()]);
  if (!product) notFound();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Edit Product</h1>
      <ProductForm categories={categories} existingProduct={product} />
    </div>
  );
}
