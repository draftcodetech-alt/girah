import { auth } from "@/lib/auth";
import { logout } from "@/modules/accounts/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function AccountPage() {
  const session = await auth();
  // Phase 4 L5: proxy.ts already gates /account/*, but the page checks for
  // itself too — a matcher misconfiguration must not render "Welcome back,
  // undefined" or an account shell to an anonymous request.
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Faccount");
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal uppercase">
        My Account
      </h1>
      <p className="font-body text-body text-muted mt-2">Welcome back, {session.user.name}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link
          href="/account/orders"
          className="border border-border bg-sage-light rounded-[var(--radius-surface)] p-8 hover:bg-sage-light/70 transition-colors"
        >
          <h2 className="font-body text-card-title uppercase tracking-[0.04em] text-charcoal">
            Orders
          </h2>
          <p className="font-body text-small text-muted mt-2">View your previous purchases</p>
          <span className="font-body text-small font-medium text-sage mt-4 inline-block">
            View&nbsp;→
          </span>
        </Link>
        <Link
          href="/account/profile"
          className="border border-border bg-sage-light rounded-[var(--radius-surface)] p-8 hover:bg-sage-light/70 transition-colors"
        >
          <h2 className="font-body text-card-title uppercase tracking-[0.04em] text-charcoal">
            Profile
          </h2>
          <p className="font-body text-small text-muted mt-2">Manage your account information</p>
          <span className="font-body text-small font-medium text-sage mt-4 inline-block">
            Edit&nbsp;→
          </span>
        </Link>
        <Link
          href="/account/addresses"
          className="border border-border bg-sage-light rounded-[var(--radius-surface)] p-8 hover:bg-sage-light/70 transition-colors"
        >
          <h2 className="font-body text-card-title uppercase tracking-[0.04em] text-charcoal">
            Saved Shipping
          </h2>
          <p className="font-body text-small text-muted mt-2">
            Save the address checkout fills in for you
          </p>
          <span className="font-body text-small font-medium text-sage mt-4 inline-block">
            Manage&nbsp;→
          </span>
        </Link>
        <Link
          href="/wishlist"
          className="border border-border bg-sage-light rounded-[var(--radius-surface)] p-8 hover:bg-sage-light/70 transition-colors"
        >
          <h2 className="font-body text-card-title uppercase tracking-[0.04em] text-charcoal">
            Wishlist
          </h2>
          <p className="font-body text-small text-muted mt-2">Pieces you&apos;ve saved for later</p>
          <span className="font-body text-small font-medium text-sage mt-4 inline-block">
            View&nbsp;→
          </span>
        </Link>
      </div>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold uppercase tracking-[0.02em] bg-sage-light text-charcoal"
        >
          Log Out
        </button>
      </form>
    </div>
  );
}
