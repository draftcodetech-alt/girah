import { notFound } from "next/navigation";
import { getAdminProductById, getAdminCategories } from "@/modules/admin";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageManager } from "@/components/admin/ImageManager";
import { VariationForm } from "@/components/admin/VariationForm";
import { VariationRow } from "@/components/admin/VariationRow";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProductById(id), getAdminCategories()]);
  if (!product) notFound();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Edit Product</h1>
      <ProductForm categories={categories} existingProduct={product} />

      <section aria-labelledby="images-heading" className="mt-10 border-t border-border pt-8">
        <h2
          id="images-heading"
          className="font-[family-name:var(--font-display)] text-h2 text-charcoal mb-4"
        >
          Images
        </h2>
        <ImageManager productId={product.id} images={product.images} />
      </section>

      <section aria-labelledby="variations-heading" className="mt-10 border-t border-border pt-8">
        <h2
          id="variations-heading"
          className="font-[family-name:var(--font-display)] text-h2 text-charcoal mb-4"
        >
          Variations
        </h2>
        {product.variations.length === 0 ? (
          <p className="font-body text-body text-muted">
            No variations yet — add the first one below.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {product.variations.map((variation) => (
              <VariationRow
                key={variation.id}
                variation={{
                  id: variation.id,
                  name: variation.name,
                  price: variation.price,
                  stock: variation.stock,
                  isEnabled: variation.isEnabled,
                  product: { name: product.name },
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-3">
            Add variation
          </h3>
          <VariationForm productId={product.id} />
        </div>
      </section>
    </div>
  );
}
