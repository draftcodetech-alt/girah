import Link from "next/link";
import { auth } from "@/lib/auth";
import { CartBadge } from "./CartBadge";
import { MobileMenu } from "./MobileMenu";
import { Input } from "@/components/ui/Input";

export async function Header() {
  const session = await auth();

  const primaryLinks = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    // Phase 17 content pages — both real routes (FAQ deliberately absent).
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    ...(session?.user ? [{ label: "Wishlist", href: "/wishlist" }] : []),
  ];
  const accountLink = session?.user
    ? { label: "Account", href: "/account" }
    : { label: "Sign In", href: "/login" };
  const secondaryLinks = [accountLink, { label: "Cart", href: "/cart" }];

  return (
    <header className="border-b border-border relative">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 h-16 md:h-20 flex items-center gap-4 md:gap-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-h3 text-charcoal shrink-0 hover:text-sage transition-colors"
        >
          Girah
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-body text-charcoal hover:text-sage transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Header search — Phase 15: GET to the dedicated /search results
            page (the inline /shop search keeps filtering the shop list). */}
        <form method="GET" action="/search" className="hidden md:flex flex-1 justify-center px-4">
          <label htmlFor="header-search" className="sr-only">
            Search products
          </label>
          <Input
            id="header-search"
            type="search"
            name="search"
            placeholder="Search products"
            size="sm"
            autoComplete="off"
            className="max-w-[360px]"
          />
        </form>

        <div className="ml-auto flex items-center gap-4 md:gap-6">
          <Link
            href={accountLink.href}
            className="font-body text-body text-charcoal hover:text-sage transition-colors"
          >
            {accountLink.label}
          </Link>
          <CartBadge />
          <MobileMenu primary={primaryLinks} secondary={secondaryLinks} />
        </div>
      </div>
    </header>
  );
}
