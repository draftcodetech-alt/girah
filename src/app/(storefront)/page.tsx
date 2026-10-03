import { getProducts } from "@/modules/catalog";
import type { ProductListItem } from "@/modules/catalog";
import { getWishlistProductIds } from "@/modules/wishlist";
import { Hero } from "@/components/storefront/home/Hero";
import { GalleryCollage } from "@/components/storefront/home/GalleryCollage";
import { CollectionSections } from "@/components/storefront/home/CollectionSections";
import { ClosingCta } from "@/components/storefront/home/ClosingCta";
import { InstagramShowcase } from "@/components/storefront/home/InstagramShowcase";
import { HandmadePromise } from "@/components/storefront/home/HandmadePromise";

export default async function Home() {
  const [featuredPool, newestPool, botanicalPool, giftPool, wishedIds] =
    await Promise.all([
      getProducts({ sort: "featured" }),
      getProducts({ sort: "newest" }),
      Promise.all([
        getProducts({ categorySlug: "bouquets" }),
        getProducts({ categorySlug: "home-decor" }),
      ]).then(([bouquets, homeDecor]) => [...bouquets, ...homeDecor]),
      Promise.all([
        getProducts({ categorySlug: "keychains" }),
        getProducts({ categorySlug: "bracelets" }),
      ]).then(([keychains, bracelets]) => [...keychains, ...bracelets]),
      getWishlistProductIds(),
    ]);
  const wished = new Set(wishedIds);
  // The original catalog trio (the old featured section above the
  // collections) is kept off the homepage by request — it only seeds the
  // exclusion set so the curated sections below never surface it.
  const offHome = featuredPool.slice(0, 3);

  // Curated homepage collections: each section never repeats a card already
  // shown above it, and CollectionSections auto-hides empty sections.
  const shown = new Set(offHome.map((product) => product.id));
  const pick = (pool: ProductListItem[]): ProductListItem[] => {
    const chosen = pool.filter((product) => !shown.has(product.id)).slice(0, 3);
    chosen.forEach((product) => shown.add(product.id));
    return chosen;
  };
  const newest = pick(newestPool);
  const botanical = pick(botanicalPool);
  const gifts = pick(giftPool);

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

      <CollectionSections newest={newest} botanical={botanical} gifts={gifts} wished={wished} />

      {/* Trust/promise strip — reference "Handmade Promise" design; the
          sr-only heading keeps the section's accessible name + test lock. */}
      <section aria-labelledby="home-trust" className="bg-cream pb-16">
        <h2 id="home-trust" className="sr-only">
          Why shop with Girah
        </h2>
        <HandmadePromise />
      </section>

      <ClosingCta />
      <InstagramShowcase />
    </div>
  );
}
