import Link from "next/link";
import { getAdminProducts } from "@/modules/admin";

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

      <div className="divide-y divide-border">
        {products.map((product) => (
          <div key={product.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-body text-body font-medium text-charcoal">{product.name}</p>
              <p className="font-body text-small text-muted mt-1">
                {product.category.name} · {product.variations.length} variation(s)
              </p>
            </div>
            <Link href={`/admin/products/${product.id}`} className="font-body text-small text-sage font-medium">
              Edit →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
