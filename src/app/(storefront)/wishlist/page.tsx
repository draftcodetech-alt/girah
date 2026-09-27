import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWishlistProducts } from "@/modules/wishlist";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function WishlistPage() {
  // The proxy already bounces anonymous visitors to /login?callbackUrl=…;
  // this guard keeps the page correct in any rendering context that skips it.
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/wishlist");
  const products = await getWishlistProducts();

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Wishlist
      </h1>
      <p className="font-body text-body text-muted text-center mt-4" role="status">
        {products.length === 0
          ? "Nothing saved yet."
          : `${products.length} saved ${products.length === 1 ? "item" : "items"}`}
      </p>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <h2 className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
            No saved items yet
          </h2>
          <p className="font-body text-body text-muted mt-4">
            Tap the heart on any piece to keep it here for later.
          </p>
          <p className="mt-6">
            <Link href="/shop" className="text-sage font-medium font-body">
              Browse the shop
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} wishlisted />
          ))}
        </div>
      )}
    </div>
  );
}
