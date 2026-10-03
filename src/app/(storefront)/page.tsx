import { getProducts } from "@/modules/catalog";
import { getWishlistProductIds } from "@/modules/wishlist";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Hero } from "@/components/storefront/home/Hero";
import { GalleryCollage } from "@/components/storefront/home/GalleryCollage";
import { ImmersiveBouquet } from "@/components/storefront/home/ImmersiveBouquet";
import { ClosingCta } from "@/components/storefront/home/ClosingCta";
import { InstagramShowcase } from "@/components/storefront/home/InstagramShowcase";
import { HandmadePromise } from "@/components/storefront/home/HandmadePromise";

export default async function Home() {
  const [products, wishedIds] = await Promise.all([
    getProducts({ sort: "featured" }),
    getWishlistProductIds(),
  ]);
  const wished = new Set(wishedIds);
  // Featured is a curated trio per the design spec; the full catalog lives
  // on /shop ("featured" has no admin flag yet — catalog order).
  const featured = products.slice(0, 3);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Girah",
        url: appUrl,
        description: "Handmade pieces, made to be cherished.",
      },
      {
        "@type": "Organization",
        name: "Girah",
        url: appUrl,
        description: "Handmade crochet pieces — bouquets, keychains and keepsakes.",
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <Hero />
      <GalleryCollage />

      <section aria-labelledby="home-featured" className="bg-cream pb-16">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <h2
            id="home-featured"
            className="font-[family-name:var(--font-display)] font-medium text-[32px] leading-[1.15] text-charcoal max-w-[500px] lg:text-[40px]"
          >
            FIND SOMETHING TO CHERISH
          </h2>

          {featured.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {featured.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  wishlisted={wished.has(product.id)}
                  priority={index === 0}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-[var(--radius-panel)] border border-border bg-cream p-10 text-center">
              <p className="font-body text-body text-muted">
                The workshop is being restocked — new pieces land here soon.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Trust/promise strip — reference "Handmade Promise" design; the
          sr-only heading keeps the section's accessible name + test lock. */}
      <section aria-labelledby="home-trust" className="bg-cream pb-16">
        <h2 id="home-trust" className="sr-only">
          Why shop with Girah
        </h2>
        <HandmadePromise />
      </section>

      <ImmersiveBouquet />
      <ClosingCta />
      <InstagramShowcase />
    </div>
  );
}
