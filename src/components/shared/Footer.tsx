import Link from "next/link";
import { getCategories } from "@/modules/catalog";

// Every href here must resolve to a route that exists — no dead links
// (About/FAQ/Contact/Privacy/Terms pages do not exist yet and must not be linked).
const SHOP_LINKS = [{ label: "All Products", href: "/shop" }];

const ACCOUNT_LINKS = [
  { label: "My account", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Profile", href: "/account/profile" },
  { label: "Shipping address", href: "/account/addresses" },
  { label: "Sign in", href: "/login" },
  { label: "Create account", href: "/register" },
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

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-body text-small text-muted hover:text-sage transition-colors"
    >
      {label}
    </Link>
  );
}

export async function Footer() {
  const categories = await getCategories();
  const year = new Date().getFullYear();
  const social = socialLinks();

  return (
    <footer className="border-t border-border bg-cream">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 pt-16 pb-8">
        <div className="text-center">
          <p className="font-[family-name:var(--font-display)] text-h3 text-charcoal">Girah</p>
          <p className="font-body text-body text-muted mt-6">
            Handmade pieces, made to be cherished.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-10 max-w-[640px] mx-auto">
          <nav aria-label="Shop links">
            <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal text-center">
              Shop
            </h2>
            <ul className="mt-4 space-y-2 text-center">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
              {categories.map((category) => (
                <li key={category.id}>
                  <FooterLink
                    href={`/shop?category=${category.slug}`}
                    label={category.name}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account links">
            <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal text-center">
              Account
            </h2>
            <ul className="mt-4 space-y-2 text-center">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {social.length > 0 && (
          <ul className="mt-16 flex items-center justify-center gap-6" aria-label="Social links">
            {social.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="font-body text-small text-sage hover:text-charcoal transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-center md:text-left">
          <p className="font-body text-small text-muted">© {year} Girah</p>
          <p className="font-body text-small text-muted">
            Cash on delivery · Secure payments with Safepay
          </p>
        </div>
      </div>
    </footer>
  );
}
