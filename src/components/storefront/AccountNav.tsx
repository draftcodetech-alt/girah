"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCOUNT_TABS = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Shipping address", href: "/account/addresses" },
  { label: "Profile", href: "/account/profile" },
];

/**
 * Section nav shared by every /account/* page (rendered from the layout).
 * A tab is "current" for its exact path AND its children (e.g. an order
 * detail under Orders) — prefix match with the separator guard so
 * "/account/orders" never lights up for "/account/order-history".
 * Links only — no tab role (aria-current convention from the header).
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="border-b border-border mb-8 print:hidden">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {ACCOUNT_TABS.map((tab) => {
          const isCurrent =
            pathname === tab.href ||
            (tab.href !== "/account" && pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-block py-3 font-body text-small font-semibold border-b-2 -mb-px transition-colors ${
                  isCurrent
                    ? "border-sage text-charcoal"
                    : "border-transparent text-muted hover:text-charcoal"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
