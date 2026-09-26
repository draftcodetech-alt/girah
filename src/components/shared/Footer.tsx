import Link from "next/link";
import { getCategories } from "@/modules/catalog";

// Every href here must resolve to a route that exists — no dead links
// (About/FAQ/Contact pages do not exist yet and must not be linked).
const SHOP_LINKS = [
  { label: "Shop all", href: "/shop" },
  { label: "Cart", href: "/cart" },
  { label: "Checkout", href: "/checkout" },
];

const ACCOUNT_LINKS = [
  { label: "My account", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Profile", href: "/account/profile" },
  { label: "Sign in", href: "/login" },
  { label: "Create account", href: "/register" },
];

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

  return (
    <footer className="border-t border-border bg-sage-light/60">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p className="font-[family-name:var(--font-display)] text-h3 text-charcoal">Girah</p>
            <p className="font-body text-small text-muted mt-3 max-w-[320px]">
              Handmade crochet pieces — bouquets, keychains and little keepsakes, stitched one by
              one in Pakistan.
            </p>
          </div>

          <nav aria-label="Shop links">
            <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
              Shop
            </h2>
            <ul className="mt-4 space-y-2">
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
            <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
              Account
            </h2>
            <ul className="mt-4 space-y-2">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="font-body text-small text-muted">
            Cash on delivery · Secure payments with Safepay
          </p>
          <p className="font-body text-small text-muted">
            © {year} Girah · Handmade in Pakistan
          </p>
        </div>
      </div>
    </footer>
  );
}
