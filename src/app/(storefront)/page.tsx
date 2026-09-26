import Link from "next/link";
import { getCategories, getProducts } from "@/modules/catalog";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ButtonLink } from "@/components/ui/ButtonLink";

const TRUST_POINTS = [
  {
    title: "Handmade to order",
    body: "Every piece is crocheted by hand in small batches — no two are ever exactly alike.",
  },
  {
    title: "Cash on delivery",
    body: "Prefer to pay when your order arrives? Cash on delivery is available nationwide.",
  },
  {
    title: "Secure online payment",
    body: "Prefer cards? Pay online through Safepay, with payments verified server-side.",
  },
];

export default async function Home() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ sort: "featured" }),
  ]);
  // Featured grid is capped; "featured" has no admin flag yet (catalog order).
  const featured = products.slice(0, 6);

  return (
    <div>
      <section className="bg-sage-light">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-28">
          <p className="font-body text-label font-semibold tracking-[0.12em] uppercase text-sage">
            Handmade crochet
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-display text-charcoal mt-4 max-w-[760px]">
            Pieces made by hand, one stitch at a time.
          </h1>
          <p className="font-body text-body text-muted mt-6 max-w-[560px]">
            Bouquets that never wilt, keychains with character — crafted slowly in Pakistan and
            shipped to your door.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <ButtonLink href="/shop">Shop the collection</ButtonLink>
            <ButtonLink href="/shop?sort=newest" variant="outline">
              What&apos;s new
            </ButtonLink>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section aria-labelledby="home-categories" className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-16">
          <h2
            id="home-categories"
            className="font-[family-name:var(--font-display)] text-h2 text-charcoal"
          >
            Shop by category
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className="h-10 px-5 inline-flex items-center rounded-[var(--radius-control)] border border-sage font-body text-small text-sage hover:bg-sage-light transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-featured" className="bg-sage-light/50">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="home-featured"
                className="font-[family-name:var(--font-display)] text-h2 text-charcoal"
              >
                Featured pieces
              </h2>
              <p className="font-body text-body text-muted mt-3">
                A few favourites from the workshop.
              </p>
            </div>
            <ButtonLink href="/shop" variant="outline" size="sm" className="shrink-0">
              View all
            </ButtonLink>
          </div>

          {featured.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  number={String(index + 1).padStart(2, "0")}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-[var(--radius-panel)] border border-border bg-cream p-10 text-center">
              <p className="font-body text-body text-muted">
                The workshop is being restocked — new pieces land here soon.
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink href="/shop" variant="secondary" size="sm">
                  Browse the shop
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="home-trust" className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-16">
        <h2 id="home-trust" className="sr-only">
          Why shop with Girah
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_POINTS.map((point) => (
            <li
              key={point.title}
              className="rounded-[var(--radius-panel)] border border-border bg-cream p-6"
            >
              <h3 className="font-body text-card-title text-charcoal">{point.title}</h3>
              <p className="font-body text-small text-muted mt-2">{point.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-sage text-cream">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-h2">Made to be cherished</h2>
            <p className="font-body text-body mt-3 max-w-[560px] text-cream/85">
              Each order supports a small workshop that does things slowly, on purpose. Find a
              piece for someone you love — or for yourself.
            </p>
          </div>
          <ButtonLink href="/shop" variant="secondary" className="shrink-0">
            Start shopping
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
