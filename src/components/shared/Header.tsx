import Link from "next/link";
import { auth } from "@/lib/auth";
import { CartBadge } from "./CartBadge";
import { MobileMenu } from "./MobileMenu";
import { Input } from "@/components/ui/Input";

export async function Header() {
  const session = await auth();

  const menuLinks = [
    { label: "Shop", href: "/shop" },
    session?.user ? { label: "Account", href: "/account" } : { label: "Sign In", href: "/login" },
    { label: "Cart", href: "/cart" },
  ];

  return (
    <header className="border-b border-border relative">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center gap-4 md:gap-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-h3 text-charcoal shrink-0"
        >
          Girah
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
          <Link
            href="/shop"
            className="font-body text-body text-charcoal hover:text-sage transition-colors"
          >
            Shop
          </Link>
        </nav>

        {/* Header search — GET to /shop, same contract as the inline shop search. */}
        <form method="GET" action="/shop" className="hidden md:flex flex-1 justify-center px-4">
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
          {session?.user ? (
            <Link
              href="/account"
              className="font-body text-body text-charcoal hover:text-sage transition-colors"
            >
              Account
            </Link>
          ) : (
            <Link
              href="/login"
              className="font-body text-body text-charcoal hover:text-sage transition-colors"
            >
              Sign In
            </Link>
          )}
          <CartBadge />
          <MobileMenu links={menuLinks} />
        </div>
      </div>
    </header>
  );
}
