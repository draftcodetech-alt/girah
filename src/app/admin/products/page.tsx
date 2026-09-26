import Link from "next/link";
import Image from "next/image";
import { getAdminProducts } from "@/modules/admin";
import { ProductDeleteButton } from "@/components/admin/ProductDeleteButton";
import { isOptimizableImageUrl } from "@/lib/image";

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">Products</h1>
        <Link
          href="/admin/products/new"
          className="h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
        >
          + Add Product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="font-body text-body text-muted">No products yet — add the first one.</p>
      ) : (
        <div className="divide-y divide-border">
          {products.map((product) => {
            const cover = product.images[0]?.url ?? null;
            return (
              <div key={product.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  {cover && isOptimizableImageUrl(cover) ? (
                    <Image
                      src={cover}
                      alt={product.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-[var(--radius-control)] object-cover bg-sage-light shrink-0"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="w-14 h-14 rounded-[var(--radius-control)] bg-sage-light shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-body text-body font-medium text-charcoal truncate">
                      {product.name}
                    </p>
                    <p className="font-body text-small text-muted mt-1">
                      {product.category.name} · {product.variations.length} variation(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-body text-small text-sage font-medium"
                  >
                    Edit →
                  </Link>
                  <ProductDeleteButton productId={product.id} productName={product.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
