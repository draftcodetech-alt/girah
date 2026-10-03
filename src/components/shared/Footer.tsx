import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/modules/catalog";
import { FooterNewsletter } from "./FooterNewsletter";

const SHOP_LINKS = [{ label: "All Products", href: "/shop" }];

const ACCOUNT_LINKS = [
  { label: "My account", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Profile", href: "/account/profile" },
  { label: "Shipping address", href: "/account/addresses" },
  { label: "Sign in", href: "/login" },
  { label: "Create account", href: "/register" },
];

// Phase 17: the six content pages — every href resolves to a real route.
const INFO_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Shipping & Delivery", href: "/shipping" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

// Social row is gated — real links only, rendered when configured
// (the design forbids fake/social placeholders).
function socialLinks() {
  const links: { label: string; href: string }[] = [];
  if (process.env.NEXT_PUBLIC_INSTAGRAM_URL) {
    links.push({ label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL });
  }
  if (process.env.NEXT_PUBLIC_WHATSAPP_URL) {
    links.push({ label: "WhatsApp", href: process.env.NEXT_PUBLIC_WHATSAPP_URL });
  }
  if (process.env.NEXT_PUBLIC_CONTACT_EMAIL) {
    links.push({ label: "Email", href: `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}` });
  }
  return links;
}

// ── Line-art decorations (ported from the reference footer) ─────────────
// Drawn as plain components rather than <defs>+<use> so the footer owns
// no fragment ids (Hero already defines #lf on the homepage).

const LEAF_SPRIG_PLACEMENTS = [
  [28, 126, -72, 1.15],
  [50, 117, 18, 1.05],
  [72, 107, -62, 1],
  [96, 93, 14, 1.1],
  [116, 79, -66, 1.05],
  [138, 62, 8, 1],
  [152, 51, -70, 0.95],
  [176, 32, -48, 0.9],
  [192, 18, -58, 0.8],
] as const;

function LeafGlyph() {
  return (
    <>
      <path
        d="M0 0C6-12 26-16 44-8C34 6 14 10 0 0Z"
        fill="rgba(125,155,112,.2)"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2 0L38-7" stroke="currentColor" strokeWidth=".8" fill="none" />
      <path
        d="M12-3L18-10M20-4L27-11M12 1L19 6M21-3L29 4"
        stroke="currentColor"
        strokeWidth=".5"
        fill="none"
        opacity=".7"
      />
    </>
  );
}

function Sprig({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" aria-hidden="true">
      <path
        d="M8 132C60 112 112 78 192 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill="none">
        {LEAF_SPRIG_PLACEMENTS.map(([x, y, rotate, scale]) => (
          <g
            key={`${x}-${y}`}
            transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
          >
            <LeafGlyph />
          </g>
        ))}
      </g>
    </svg>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 29V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M16 18C8 18 5 12 5 6c7 0 11 4 11 12Z" fill="currentColor" opacity=".9" />
      <path d="M16 15C16 8 19 4 26 3c0 7-3 11-10 12Z" fill="currentColor" opacity=".9" />
    </svg>
  );
}

// Each yellow leaf carries its own gradient (unique id) — no shared defs.
function YellowLeaf({
  gid,
  className,
  style,
}: {
  gid: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 70 34" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7cd6b" />
          <stop offset="1" stopColor="#e8a93a" />
        </linearGradient>
      </defs>
      <path d="M2 22C16 4 44 0 68 16C50 34 22 36 2 22Z" fill={`url(#${gid})`} />
      <path
        d="M2 22C24 20 46 18 68 16"
        stroke="#c98a22"
        strokeWidth="1"
        fill="none"
        opacity=".7"
      />
    </svg>
  );
}

const YELLOW_LEAVES: { gid: string; style: CSSProperties }[] = [
  { gid: "ft-yg-1", style: { left: "9.3em", top: "4.3em", width: "3.7em", transform: "rotate(-12deg)" } },
  { gid: "ft-yg-2", style: { left: "28.2em", top: "25.2em", width: "3.2em", transform: "rotate(28deg)" } },
  { gid: "ft-yg-3", style: { left: "93.6em", top: "26.2em", width: "3.1em", transform: "rotate(-8deg)" } },
  { gid: "ft-yg-4", style: { left: "107.5em", top: "27.6em", width: "3.1em", transform: "rotate(-32deg)" } },
  { gid: "ft-yg-5", style: { left: "93em", top: "35em", width: "3.4em", transform: "rotate(22deg)" } },
  { gid: "ft-yg-6", style: { left: "10.2em", top: "35.6em", width: "3.4em", transform: "rotate(20deg)" } },
];

function SocialIcon({ label }: { label: string }) {
  if (label === "Instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (label === "WhatsApp") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.42-17.3A11.82 11.82 0 0 0 12.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.58 0 11.94-5.36 11.95-11.94a11.9 11.9 0 0 0-3.43-8.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5 7.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return <Link href={href}>{label}</Link>;
}

export async function Footer() {
  const categories = await getCategories();
  const year = new Date().getFullYear();
  const social = socialLinks();

  return (
    <footer className="girah-footer bg-cream">
      {/* soft waves */}
      <svg className="ft-bg ft-bg-top" viewBox="0 0 2155 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0H2155V28C1800 78 1400 70 1080 66C760 62 330 96 0 24Z" fill="#fbf5ea" opacity=".75" />
      </svg>
      <svg className="ft-bg ft-bg-bottom" viewBox="0 0 2155 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70C300 36 620 66 920 52C1300 34 1740 40 2155 0V140H0Z" fill="#c9d1b9" opacity=".85" />
        <path d="M0 88C200 42 430 42 650 72C900 106 1250 62 1500 72C1800 86 2000 46 2155 18V140H0Z" fill="#a8b699" />
        <path d="M0 128C300 98 700 112 1100 98C1500 84 1900 104 2155 72V140H0Z" fill="#9aaa8a" />
      </svg>

      <div className="ft-inner">
        {/* photos (product-grid cut-outs from the reference) */}
        <Image className="ft-photo-left" src="/footer/footer-flowers.png" alt="" width={612} height={408} />
        <div className="ft-photo-right">
          <Image src="/footer/footer-sunflower.png" alt="" width={1536} height={1024} />
        </div>

        {/* decorations */}
        <Sprig className="ft-sprig ft-sprig-tl" />
        <Sprig className="ft-sprig ft-sprig-tl2" />
        <Sprig className="ft-sprig ft-sprig-tr" />
        <Sprig className="ft-sprig ft-sprig-tr2" />
        <Sprig className="ft-sprig ft-sprig-br" />
        {YELLOW_LEAVES.map((leaf) => (
          <YellowLeaf key={leaf.gid} gid={leaf.gid} className="ft-yl" style={leaf.style} />
        ))}

        {/* main content */}
        <div className="ft-main">
          <div className="ft-brand">
            <div className="ft-logo">
              Girah
              <LeafIcon />
            </div>
            <div className="ft-tag">Handmade pieces, made to be cherished.</div>
            <p>
              From lasting blooms to little keepsakes, every piece is made with care, one stitch at a
              time.
            </p>
            {social.length > 0 && (
              <div className="ft-social">
                {social.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    aria-label={link.label}
                    {...(link.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" })}
                  >
                    <SocialIcon label={link.label} />
                  </a>
                ))}
              </div>
            )}
            <svg className="ft-sprig-line" viewBox="0 0 120 20" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
              <path d="M0 11H52" />
              <path d="M52 11C62 11 72 8 84 8" strokeLinecap="round" />
              <g transform="translate(64 10)">
                <path d="M0 0C6-6 14-6 20-2C14 3 6 3 0 0Z" fill="rgba(125,155,112,.18)" />
              </g>
              <g transform="translate(50 11) rotate(25)">
                <path d="M0 0C5-5 11-5 16-2C11 2 5 3 0 0Z" fill="rgba(125,155,112,.18)" />
              </g>
              <g transform="translate(78 8) rotate(-15)">
                <path d="M0 0C6-5 13-5 18-1C13 3 6 3 0 0Z" fill="rgba(125,155,112,.18)" />
              </g>
            </svg>
          </div>

          <div className="ft-cols grid grid-cols-1 sm:grid-cols-3">
            <nav className="ft-col" aria-label="Shop links">
              <LeafIcon className="ft-leaf" />
              <h4>Shop</h4>
              <ul>
                {SHOP_LINKS.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
                {categories.map((category) => (
                  <li key={category.id}>
                    <FooterLink href={`/shop?category=${category.slug}`} label={category.name} />
                  </li>
                ))}
              </ul>
            </nav>

            <nav className="ft-col" aria-label="Account links">
              <LeafIcon className="ft-leaf" />
              <h4>Account</h4>
              <ul>
                {ACCOUNT_LINKS.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </nav>

            <nav className="ft-col" aria-label="Information links">
              <LeafIcon className="ft-leaf" />
              <h4>Information</h4>
              <ul>
                {INFO_LINKS.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="ft-news">
            <h3>
              Stay in the Loop
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.8 6.7 4.8c2 0 3.6 1.1 5.3 3.2 1.7-2.1 3.3-3.2 5.3-3.2 3.3 0 5.2 3.2 4 6.5-1.8 4.6-9.3 9.2-9.3 9.2z"
                  transform="rotate(12 12 12)"
                />
              </svg>
            </h3>
            <p>
              Be the first to know about new pieces,
              <br />
              special drops and little stories from Girah.
            </p>
            <FooterNewsletter />
          </div>
        </div>

        {/* bottom bar */}
        <div className="ft-bottom">
          <div className="ft-copy">© {year} Girah. All rights reserved.</div>
          <div className="ft-hand">
            <LeafIcon />
            <span>HANDMADE&nbsp; WITH&nbsp; LOVE</span>
          </div>
          <div className="ft-pay">
            <span>Cash on delivery · Secure payments with Safepay</span>
            <div className="ft-badges">
              <span className="ft-badge ft-badge-visa">VISA</span>
              <span className="ft-badge ft-badge-mc">
                <svg viewBox="0 0 36 22" aria-hidden="true">
                  <circle cx="13" cy="11" r="10" fill="#eb001b" />
                  <circle cx="23" cy="11" r="10" fill="#f79e1b" fillOpacity=".92" />
                </svg>
              </span>
              <span className="ft-badge ft-badge-ap">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 12.6c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2.1 1 0 1.4-.6 2.6-.6 1.2 0 1.6.6 2.6.6s1.7-1 2.4-2c.7-1.1 1-2.2 1-2.3 0 0-2-.8-2-3.2zM14.6 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z" />
                </svg>
                Pay
              </span>
              <span className="ft-badge ft-badge-gp">
                <b>G</b>&nbsp;Pay
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
