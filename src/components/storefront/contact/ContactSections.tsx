import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

const EMAIL = "syedareebkareem@gmail.com";

const orderMailto =
  `mailto:${EMAIL}?subject=${encodeURIComponent("Question about my order")}` +
  `&body=${encodeURIComponent("Hi Girah,\n\nOrder number: \n\nMy question: \n\nThank you!")}`;

const ideaMailto =
  `mailto:${EMAIL}?subject=${encodeURIComponent("A custom crochet idea")}` +
  `&body=${encodeURIComponent("Hi Girah,\n\nThe flower or keepsake I have in mind: \nColours I love: \nOccasion or date (if any): \n\nThank you!")}`;

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 border-b border-gold pb-[3px] font-body text-body font-medium text-charcoal transition-[gap,border-color] hover:gap-4 hover:border-charcoal"
    >
      {children}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12h16M14 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/**
 * Contact page — ported from the approved `eb/index.html` mockup (copy,
 * prefilled mailtos, Islamabad base, imagery) with palette/type snapped to
 * site tokens. Every channel is real: the address, the subjects, the city.
 */
export function ContactSections() {
  return (
    <div className="max-w-[1040px] mx-auto px-4 md:px-7">
      <nav aria-label="Breadcrumb" className="pt-5">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      </nav>

      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
        <div className="pt-3">
          <p className="flex items-center gap-3.5 font-body text-label font-medium uppercase tracking-[0.26em] text-charcoal">
            Get in touch
            <span aria-hidden="true" className="inline-block h-px w-14 bg-gold" />
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mt-5 max-w-[10em]">
            Let&rsquo;s talk about something special.
          </h1>
          <p className="font-body text-body text-muted leading-relaxed max-w-[27em] mt-5">
            Whether you have a question about an order, need a little help, or have
            an idea for a custom creation, we&rsquo;re here to listen.
          </p>

          <div className="flex items-center gap-4 mt-7">
            <span aria-hidden="true" className="grid place-items-center w-[46px] h-[46px] rounded-full bg-sage-light shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal">
                <rect x="3" y="5" width="18" height="14" rx="1.5" />
                <path d="m3.5 6.5 8.5 7 8.5-7" />
              </svg>
            </span>
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <p className="font-body text-card-title font-medium text-charcoal break-all leading-tight">
                {EMAIL}
              </p>
              <ArrowLink href={`mailto:${EMAIL}`}>Send us an email</ArrowLink>
            </div>
          </div>
        </div>

        <div className="justify-self-center md:justify-self-end w-full max-w-[470px]">
          <Image
            src="/contact/boquet_contact_us.webp"
            alt="A handmade crochet flower bouquet wrapped in kraft paper with a “Handmade with love” tag"
            width={1362}
            height={1155}
            priority
            sizes="(min-width: 768px) 45vw, 100vw"
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* Help */}
      <section aria-labelledby="contact-help" className="pt-8">
        <h2 id="contact-help" className="flex items-center justify-center gap-6 text-center font-[family-name:var(--font-display)] text-h3 uppercase tracking-[0.22em] text-charcoal">
          <span aria-hidden="true" className="inline-block h-px w-20 bg-gold" />
          How can we help you?
          <span aria-hidden="true" className="inline-block h-px w-20 bg-gold" />
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <article className="flex flex-col items-start md:pr-12 max-md:pb-2">
            <Image src="/contact/email_with_leaf.webp" alt="" width={200} height={140} loading="lazy" sizes="200px" className="h-[74px] w-auto mb-2" />
            <h3 className="font-[family-name:var(--font-display)] text-h3 text-charcoal mt-2">
              A question about your order?
            </h3>
            <p className="font-body text-body text-muted leading-relaxed max-w-[26em] mt-3 mb-5">
              Whether you&rsquo;d like an update or need help with something
              you&rsquo;ve received, send us an email and include your order
              number so we can identify your purchase.
            </p>
            <span className="mt-auto">
              <ArrowLink href={orderMailto}>Email about an order</ArrowLink>
            </span>
          </article>

          <article className="flex flex-col items-start md:pl-12 md:border-l md:border-border max-md:border-t max-md:border-border max-md:pt-8">
            <Image src="/contact/flower_with_leaves.webp" alt="" width={200} height={120} loading="lazy" sizes="200px" className="h-[74px] w-auto mb-2" />
            <h3 className="font-[family-name:var(--font-display)] text-h3 text-charcoal mt-2">
              Dreaming of something different?
            </h3>
            <p className="font-body text-body text-muted leading-relaxed max-w-[26em] mt-3 mb-5">
              Have a particular flower, colour combination, or little crochet
              keepsake in mind? Tell us what you&rsquo;re imagining, and
              let&rsquo;s explore the possibilities together.
            </p>
            <span className="mt-auto">
              <ArrowLink href={ideaMailto}>Discuss your idea</ArrowLink>
            </span>
          </article>
        </div>
      </section>

      {/* Banner */}
      <section aria-label="Our promise" className="pt-10">
        <div className="relative max-w-[600px] mx-auto px-5 py-8 text-center rounded-[var(--radius-panel)] bg-sage-light overflow-hidden">
          <Image src="/contact/leaf.webp" alt="" width={96} height={96} aria-hidden="true" loading="lazy" className="hidden sm:block absolute left-2 top-1/2 -translate-y-1/2 w-24 opacity-80" />
          <Image src="/contact/leaf.webp" alt="" width={96} height={96} aria-hidden="true" loading="lazy" className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 w-24 -scale-x-100 opacity-80" />
          <p className="font-body text-label font-medium uppercase tracking-[0.28em] text-charcoal">
            Every special piece starts with a
          </p>
          <p className="font-[family-name:var(--font-display)] italic font-light text-[clamp(38px,5.4vw,48px)] leading-tight text-charcoal mt-1">
            little idea.
          </p>
          <p className="font-body text-body text-muted mt-2">Made by hand. Made with care. Made for you.</p>
        </div>
        <p className="text-center font-body text-small text-muted mt-8">
          Based in Islamabad, Pakistan · Made with care.
        </p>
      </section>
    </div>
  );
}
