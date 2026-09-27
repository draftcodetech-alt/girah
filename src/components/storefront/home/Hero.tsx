import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * Hero — design spec: text-left / floral-right (no image box, no card),
 * single CTA, ~80vh composition on cream, flowers never cross the headline.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="home-hero"
      className="relative overflow-hidden bg-cream min-h-[80vh] flex items-center pt-6 pb-12 lg:pb-16"
    >
      {/* Florals — desktop: unboxed, flowing in from the right edge */}
      <div
        className="hidden lg:block absolute right-0 inset-y-0 w-[48%] pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute right-[4%] top-1/2 -translate-y-[54%] w-[62%] z-10">
          <Image
            src="/florals/sunflower.png"
            alt=""
            width={1031}
            height={1318}
            priority
            sizes="30vw"
            className="w-full h-auto"
          />
        </div>
        <div className="absolute right-[34%] top-1/2 -translate-y-[46%] w-[44%] z-0">
          <Image
            src="/florals/lily.png"
            alt=""
            width={1024}
            height={1462}
            priority
            sizes="22vw"
            className="w-full h-auto"
          />
        </div>
      </div>

      <div className="relative z-10 w-full px-4 md:px-6 lg:px-0">
        <div className="max-w-[600px] lg:ml-[8vw]">
          <h1
            id="home-hero"
            className="font-[family-name:var(--font-display)] font-medium text-[42px] leading-[1.08] tracking-[-0.02em] text-charcoal lg:text-[64px] lg:leading-[1.05]"
          >
            Handmade Pieces, Made to Be Cherished.
          </h1>
          <p className="font-body text-body text-muted mt-6 max-w-[480px]">
            From lasting blooms to little keepsakes, every piece is made with care.
          </p>
          <div className="mt-8">
            <ButtonLink href="/shop">Shop Handmade</ButtonLink>
          </div>
        </div>

        {/* Florals — mobile: below the copy, reduced presence */}
        <div className="lg:hidden mt-10 flex justify-center gap-2" aria-hidden="true">
          <Image
            src="/florals/sunflower.png"
            alt=""
            width={1031}
            height={1318}
            priority
            sizes="70vw"
            className="w-[56%] h-auto max-h-[44vh] object-contain"
          />
          <Image
            src="/florals/lily.png"
            alt=""
            width={1024}
            height={1462}
            sizes="40vw"
            className="w-[38%] h-auto max-h-[44vh] object-contain self-end"
          />
        </div>
      </div>
    </section>
  );
}
