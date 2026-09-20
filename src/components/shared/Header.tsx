// MINIMAL SCAFFOLD — full Girah header (logo, nav, mobile menu per girah.md §14)
// is a separate future task. This exists to mount CartBadge + auth-aware links.
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CartBadge } from "./CartBadge";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-border">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
          Girah
        </Link>
        <div className="flex items-center gap-6">
          {session?.user ? (
            <Link href="/account" className="font-body text-body text-charcoal">
              Account
            </Link>
          ) : (
            <Link href="/login" className="font-body text-body text-charcoal">
              Sign In
            </Link>
          )}
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
