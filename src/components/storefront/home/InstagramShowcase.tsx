import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/**
 * Instagram showcase — gated: renders only when a real profile URL is
 * configured AND real tiles exist in public/instagram/. The design spec
 * forbids hard-coded fake posts, so without assets this returns null.
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
    <section aria-labelledby="home-instagram" className="bg-cream py-24">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <h2
          id="home-instagram"
          className="font-[family-name:var(--font-display)] font-medium text-[26px] leading-[1.1] text-charcoal text-center lg:text-[32px]"
        >
          FOLLOW GIRAH
        </h2>
        <p className="font-body text-small text-muted text-center mt-4">
          A little peek at what we&apos;re making.
        </p>

        <ul className="mt-10 grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
          {tiles.map((tile) => (
            <li key={tile}>
              <Link
                href={profileUrl}
                className="group block relative aspect-square overflow-hidden rounded-[var(--radius-surface)] bg-sage-light transition-transform duration-[250ms] ease-media hover:-translate-y-1"
              >
                <Image
                  src={`/instagram/${tile}`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="object-cover transition-transform duration-[250ms] ease-media group-hover:scale-105"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-center mt-8">
          <Link
            href={profileUrl}
            className="font-body text-small text-sage hover:text-charcoal transition-colors"
          >
            @girah
          </Link>
        </p>
      </div>
    </section>
  );
}
