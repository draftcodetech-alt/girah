"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TAB_ICONS: Record<string, ReactNode> = {
  "/account": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  "/account/orders": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l1 13H4L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  ),
  "/account/addresses": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  "/account/profile": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
    </svg>
  ),
  "/wishlist": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
    </svg>
  ),
};

const ACCOUNT_TABS = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Shipping Addresses", href: "/account/addresses" },
  { label: "Profile", href: "/account/profile" },
  { label: "Wishlist", href: "/wishlist" },
];

/**
 * Section nav shared by every /account/* page (rendered from the layout).
 * A tab is "current" for its exact path AND its children (e.g. an order
 * detail under Orders) — prefix match with the separator guard so
 * "/account/orders" never lights up for "/account/order-history".
 * Links only — no tab role (aria-current convention from the header).
 * Rendered as the vertical console sidebar; /wishlist is a real page of the
 * shop, so it simply never reports current from inside the account shell.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="acct-nav">
      <ul className="acct-nav-list">
        {ACCOUNT_TABS.map((tab) => {
          const isCurrent =
            pathname === tab.href ||
            (tab.href !== "/account" && pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={isCurrent ? "acct-nav-link is-current" : "acct-nav-link"}
              >
                {TAB_ICONS[tab.href]}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
