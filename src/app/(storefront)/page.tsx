import { getProducts } from "@/modules/catalog";
import { getWishlistProductIds } from "@/modules/wishlist";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Hero } from "@/components/storefront/home/Hero";
import { MagazineGrid } from "@/components/storefront/home/MagazineGrid";
import { ImmersiveBouquet } from "@/components/storefront/home/ImmersiveBouquet";
import { ClosingCta } from "@/components/storefront/home/ClosingCta";
import { InstagramShowcase } from "@/components/storefront/home/InstagramShowcase";

const TRUST_POINTS = [
  {
    title: "Handmade to order",
    body: "Every piece is crocheted by hand in small batches — no two are ever exactly alike.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" />
        <path d="M5 19c0-4 2-8 6-10" />
      </svg>
    ),
  },
  {
    title: "Cash on delivery",
    body: "Prefer to pay when your order arrives? Cash on delivery is available nationwide.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    title: "Secure online payment",
    body: "Prefer cards? Pay online through Safepay, with payments verified server-side.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      </svg>
    ),
  },
];

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
      <MagazineGrid />

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
                  number={String(index + 1).padStart(2, "0")}
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

      {/* Trust strip — not in the design doc, kept per research (trust
          signals matter for handmade stores), restyled quiet on cream. */}
      <section aria-labelledby="home-trust" className="bg-cream pb-16">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <h2 id="home-trust" className="sr-only">
            Why shop with Girah
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TRUST_POINTS.map((point) => (
              <li key={point.title}>
                <div className="text-sage">{point.icon}</div>
                <h3 className="font-body text-card-title text-charcoal mt-3">{point.title}</h3>
                <p className="font-body text-small text-muted mt-2 max-w-[340px]">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ImmersiveBouquet />
      <ClosingCta />
      <InstagramShowcase />
    </div>
  );
}
