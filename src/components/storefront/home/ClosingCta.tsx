import { ButtonLink } from "@/components/ui/ButtonLink";

/** Closing CTA — design spec: centered, cream background, nothing else. */
export function ClosingCta() {
  return (
    <section aria-labelledby="home-closing" className="bg-cream pt-24 pb-20 lg:pt-30">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 text-center">
        <p className="font-body text-label font-medium tracking-[0.08em] uppercase text-sage">
          A SMALL GIRAH MOMENT
        </p>
        <h2
          id="home-closing"
          className="font-[family-name:var(--font-display)] font-medium text-[32px] leading-[1.15] text-charcoal max-w-[420px] mx-auto mt-4 lg:text-[40px]"
        >
          Handmade things,
          <br />
          made to stay.
        </h2>
        <div className="mt-8">
          <ButtonLink href="/shop">Shop Handmade</ButtonLink>
        </div>
      </div>
    </section>
  );
}
