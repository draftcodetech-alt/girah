import { auth } from "@/lib/auth";
import { logout } from "@/modules/accounts/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

// Sidebar-matching glyph per destination — purely decorative (aria-hidden),
// same house style as the reference console.
const CARD_ICONS: Record<string, ReactNode> = {
  "/account/orders": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l1 13H4L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  ),
  "/account/profile": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
    </svg>
  ),
  "/account/addresses": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  "/wishlist": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
    </svg>
  ),
};

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
    <div className="acct-page">
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
            <span className="ax-card-glyph" aria-hidden="true">
              {CARD_ICONS[card.href]}
            </span>
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
