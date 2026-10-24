import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** The Instagram glyph — same stroke shape the footer social icon uses. */
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className={className}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Tiles are named after the piece they show, so the alt text stays real and
// descriptive without hard-coding copy that would drift from the files.
function tileAlt(file: string): string {
  const stem = path.basename(file, path.extname(file)).replace(/[-_]+/g, " ");
  return `Handmade ${stem}, shared on the Girah Instagram feed`;
}

/**
 * Instagram showcase — gated: renders only when a real profile URL is
 * configured AND real tiles exist in public/instagram/. The design spec
 * forbids hard-coded fake posts, so without assets this returns null.
 *
 * Editorial gallery (owner redesign, 2026-10-24): eyebrow → serif heading →
 * one-line subtitle → five 4/5 tiles (a snap-scroll rail below lg, a single
 * grid row on desktop) → one Instagram CTA. Interactions are pure CSS —
 * the global reduced-motion rule in globals.css neutralises the hover zoom
 * and badge fade for anyone who asks for less motion.
 */
export function InstagramShowcase() {
  const profileUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  if (!profileUrl) return null;

  let tiles: string[] = [];
  try {
    tiles = fs
      .readdirSync(path.join(process.cwd(), "public", "instagram"))
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort()
      .slice(0, 5);
  } catch {
    tiles = [];
  }
  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="home-instagram" className="bg-cream py-20 lg:py-28">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <p className="font-body text-label font-medium tracking-[0.08em] uppercase text-sage text-center">
          MADE WITH LOVE
        </p>
        <h2
          id="home-instagram"
          className="font-[family-name:var(--font-display)] font-medium text-[32px] leading-[1.15] text-charcoal text-center mt-4 lg:text-[40px]"
        >
          A Little World of Girah
        </h2>
        <p className="font-body text-small text-muted text-center mt-4 max-w-[420px] mx-auto">
          Little things, thoughtfully handmade.
        </p>

        {/* Desktop: one 5-up row. Below lg: a snap rail showing ~80% of a
            tile plus a peek of the next, so the scroll is self-discoverable
            (the scrollbar itself is hidden, never the scrolling). */}
        <ul className="mt-10 flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
          {tiles.map((tile, i) => (
            <li key={tile} className="w-[80%] shrink-0 snap-start sm:w-[45%] lg:w-auto">
              <Link
                href={profileUrl}
                aria-label={`Girah on Instagram — photo ${i + 1}`}
                className="group block relative aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] bg-sage-light shadow-[var(--shadow-subtle)] outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <Image
                  src={`/instagram/${tile}`}
                  alt={tileAlt(tile)}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 45vw, 80vw"
                  className="object-cover object-center transition-transform duration-[300ms] ease-media group-hover:scale-[1.03]"
                />
                {/* Small badge, revealed on hover/focus — the tile is a real
                    link to the profile, so the affordance stays honest. */}
                <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream/90 text-charcoal opacity-0 shadow-[var(--shadow-subtle)] transition-opacity duration-[250ms] ease-ui group-hover:opacity-100 group-focus-visible:opacity-100">
                  <InstagramGlyph className="h-[18px] w-[18px]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center">
          <Link
            href={profileUrl}
            className="inline-flex items-center gap-3 rounded-full border border-border bg-cream px-5 py-3 font-body text-small text-charcoal transition-colors duration-[250ms] ease-ui hover:border-sage hover:text-sage outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <InstagramGlyph className="h-[18px] w-[18px]" />
            <span className="font-medium">@girah</span>
            <span aria-hidden="true" className="h-4 w-px bg-border" />
            <span className="text-muted">Follow our little world</span>
          </Link>
        </p>
      </div>
    </section>
  );
}
