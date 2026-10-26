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
        <p className="ax-eyebrow">
          <span className="ax-eyebrow-line" aria-hidden="true" />
          YOUR DASHBOARD
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase">
          My Account
        </h1>
        <p className="ax-sub">{displayName ? `Welcome back, ${displayName}` : "Welcome back"}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {DASHBOARD_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col ax-panel ax-panel-link p-6 md:p-7"
          >
            <h2 className="ax-h2">{card.title}</h2>
            <p className="ax-row-meta mt-2">{card.description}</p>
            {/* mt-auto pins the action to the bottom of every card so the
                rows stay aligned regardless of description length. */}
            <span className="mt-auto pt-5 ax-text-link">
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
          <button type="submit" className="ax-btn ax-btn--ghost uppercase tracking-[0.06em]">
            Log Out
          </button>
        </form>
      </div>
    </div>
  );
}
