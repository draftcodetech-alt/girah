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

          {/* Real WhatsApp line — only when configured (no fake handles). */}
          {process.env.NEXT_PUBLIC_WHATSAPP_URL && (
            <div className="flex items-center gap-4 mt-5">
              <span aria-hidden="true" className="grid place-items-center w-[46px] h-[46px] rounded-full bg-sage-light shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-charcoal">
                  <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.42-17.3A11.82 11.82 0 0 0 12.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.58 0 11.94-5.36 11.95-11.94a11.82 11.82 0 0 0-3.43-8.4" />
                </svg>
              </span>
              <div className="flex flex-col items-start gap-1.5 min-w-0">
                <p className="font-body text-card-title font-medium text-charcoal break-all leading-tight">
                  0310 1667543
                </p>
                <ArrowLink href={process.env.NEXT_PUBLIC_WHATSAPP_URL}>Chat on WhatsApp</ArrowLink>
              </div>
            </div>
          )}
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
