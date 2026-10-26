import { auth } from "@/lib/auth";
import { logout } from "@/modules/accounts/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

// The four dashboard destinations, kept as data so every card renders the
// same structure — title / description / action — with no drift between
// them. Routes are the real existing ones (wishlist lives outside /account).
const DASHBOARD_CARDS = [
  {
    href: "/account/orders",
    title: "Orders",
    description: "View your previous purchases",
    action: "View orders",
  },
  {
    href: "/account/profile",
    title: "Profile",
    description: "Manage your account information",
    action: "Edit profile",
  },
  {
    href: "/account/addresses",
    title: "Saved Shipping",
    description: "Save your address for a faster checkout",
    action: "Manage addresses",
  },
  {
    href: "/wishlist",
    title: "Wishlist",
    description: "Pieces you've saved for later",
    action: "View wishlist",
  },
];

export default async function AccountPage() {
  const session = await auth();
  // Phase 4 L5: proxy.ts already gates /account/*, but the page checks for
  // itself too — a matcher misconfiguration must not render "Welcome back,
  // undefined" or an account shell to an anonymous request.
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Faccount");
  }

  // Owner spec (2026-10-24, account dashboard redesign): personalized
  // greeting. A missing/blank name must never render "undefined", "null" or
  // an empty "Welcome back," — fall back to the bare greeting.
  const displayName = session.user.name?.trim();

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />

      <header className="mb-9 md:mb-10">
        {/* Refined serif heading (editorial scale, not the 52px page h1) —
            uppercase keeps the section's shared heading language. */}
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase">
          My Account
        </h1>
        <p className="font-body text-body text-muted mt-3">
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {DASHBOARD_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-[var(--radius-panel)] border border-border bg-sage-light p-6 md:p-7 transition-colors hover:border-sage/50 hover:bg-sage-light/70"
          >
            <h2 className="font-[family-name:var(--font-display)] text-card-title text-charcoal">
              {card.title}
            </h2>
            <p className="font-body text-small text-muted mt-2">{card.description}</p>
            {/* mt-auto pins the action to the bottom of every card so the
                rows stay aligned regardless of description length. */}
            <span className="mt-auto pt-5 inline-flex items-center gap-1.5 font-body text-small font-medium text-sage">
              {card.action}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Log out stays out of the card grid: a restrained secondary action,
          separated by a hairline so it never reads as a fifth card. */}
      <div className="mt-9 md:mt-10 pt-7 md:pt-8 border-t border-border">
        <form action={logout}>
          <button
            type="submit"
            className="h-11 px-6 rounded-[var(--radius-control)] border border-border bg-transparent font-body text-button font-semibold uppercase tracking-[0.02em] text-muted transition-colors hover:text-charcoal hover:border-sage"
          >
            Log Out
          </button>
        </form>
      </div>
    </div>
  );
}
