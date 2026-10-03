import Link from "next/link";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { ProductListItem } from "@/modules/catalog";

/**
 * Curated homepage collections — the three product collections shown on the
 * homepage (JUST OFF THE HOOK / FLOWERS THAT STAY / MADE TO MAKE SOMEONE
 * SMILE). The product card itself is untouched — only the surrounding composition
 * varies per section (centered compact / editorial botanical / gift-led).
 * Each section hides itself when its pool is empty, and page.tsx hands over
 * pools that already exclude cards shown higher up. Small CSS-only scroll
 * reveal lives in globals.css (.col-reveal / .collect-*).
 */

type Props = {
  newest: ProductListItem[];
  botanical: ProductListItem[];
  gifts: ProductListItem[];
  wished: Set<string>;
};

/* ── tiny botanical marks (inline; no fragment ids — Hero owns #lf) ── */

function Sprig({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M12 21C12 14 14.5 8.5 19.5 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M14.2 11.6C11.4 11.8 9.2 10.6 8 8.2C10.9 7.8 13 9.1 14.2 11.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M16.6 7.6C14.4 7.3 12.8 5.9 12.3 3.7C14.7 4.1 16.4 5.5 16.6 7.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LeafGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden="true">
      <path
        d="M20 4C11.5 4.8 5.5 9.5 4.5 18.5C4.5 18.5 13.5 19.5 18 13C21.3 8.3 20 4 20 4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M5.5 17.5C9 13.5 13 10 17.5 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function FlowerGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden="true">
      <path
        d="M12 12C8.8 8.8 8.8 5 12 3.5C15.2 5 15.2 8.8 12 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12C15.2 8.8 19 9.2 20.5 12C19 14.8 15.2 15.2 12 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12C15.2 15.2 14.8 19 12 20.5C9.2 19 8.8 15.2 12 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12C8.8 15.2 5 14.8 3.5 12C5 9.2 8.8 8.8 12 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** Soft trailing vine for section 03 — decorative only, hidden on small screens. */
function VineArt() {
  return (
    <svg viewBox="0 0 160 360" fill="none" aria-hidden="true">
      <path
        d="M118 8C132 66 120 128 92 176C66 220 62 282 84 352"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M126 62C141 57 151 46 154 32C139 35 129 46 126 62Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M104 128C89 126 78 117 73 103C88 104 99 113 104 128Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M78 196C93 193 104 182 107 167C92 170 81 181 78 196Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M66 268C51 266 40 257 36 243C51 244 62 253 66 268Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M84 330C99 326 110 315 112 300C97 304 86 315 84 330Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* ── shared pieces ── */

function Grid({ products, wished }: { products: ProductListItem[]; wished: Set<string> }) {
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} wishlisted={wished.has(product.id)} />
      ))}
    </div>
  );
}

function Cta({ href, label, align = "center" }: { href: string; label: string; align?: "center" | "left" }) {
  return (
    <div className={`mt-7 flex ${align === "center" ? "justify-center" : "justify-start"}`}>
      <Link href={href} className="collect-cta">
        {label} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/* ── sections ── */

export function CollectionSections({ newest, botanical, gifts, wished }: Props) {
  return (
    <>
      {/* small botanical divider between 01 and 02 */}
      <div className="collect-divider" aria-hidden="true">
        <Sprig size={22} />
      </div>

      {newest.length > 0 && (
        <section
          aria-labelledby="home-fresh"
          className="home-collect home-collect--fresh"
        >
          <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[640px] text-center col-reveal">
              <span className="collect-mark">
                <Sprig />
              </span>
              <h2 id="home-fresh" className="collect-title">
                JUST OFF THE HOOK
              </h2>
              <p className="collect-lede">Fresh little pieces, made with love.</p>
            </div>
            <Grid products={newest} wished={wished} />
            <Cta href="/shop?sort=newest" label="EXPLORE NEW PIECES" />
          </div>
        </section>
      )}

      {botanical.length > 0 && (
        <section
          aria-labelledby="home-botanical"
          className="home-collect home-collect--botanical"
        >
          <span className="collect-vine collect-vine--right">
            <VineArt />
          </span>
          <div className="relative mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
            <div className="max-w-[640px] col-reveal">
              <span className="collect-mark">
                <LeafGlyph />
              </span>
              <h2 id="home-botanical" className="collect-title">
                FLOWERS THAT STAY
              </h2>
              <p className="collect-lede">Botanical beauty, stitched to last.</p>
            </div>
            <Grid products={botanical} wished={wished} />
            <Cta href="/shop?category=home-decor" label="EXPLORE HOME & BOTANICALS" align="left" />
          </div>
        </section>
      )}

      {gifts.length > 0 && (
        <section aria-labelledby="home-gifts" className="home-collect home-collect--gifts">
          <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[680px] text-center col-reveal">
              <span className="collect-mark">
                <FlowerGlyph />
              </span>
              <h2 id="home-gifts" className="collect-title">
                MADE TO MAKE SOMEONE SMILE
              </h2>
              <p className="collect-lede">Thoughtful little gifts, stitched by hand.</p>
            </div>
            <Grid products={gifts} wished={wished} />
            <Cta href="/shop?category=keychains" label="SHOP LITTLE GIFTS" />
          </div>
        </section>
      )}
    </>
  );
}
