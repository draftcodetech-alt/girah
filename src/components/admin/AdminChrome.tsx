"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pure chrome: sidebar + topbar for the admin shell. Every link, label and
// active rule mirrors the nav spec (Dashboard · Catalog · Orders · Customers
// · Reviews · Newsletter) — presentation only, no data, no behaviour.

type NavItem = { href: string; label: string };

const ICONS: Record<string, React.ReactNode> = {
  "/admin": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  "/admin/catalog": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
      <path d="m4 12 8 3.5L20 12" />
      <path d="m4 16.5 8 3.5 8-3.5" />
    </svg>
  ),
  "/admin/orders": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6v3H9z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  ),
  "/admin/customers": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.9c1.7.7 2.8 2.3 3.1 4.6" />
    </svg>
  ),
  "/admin/reviews": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
    </svg>
  ),
  "/admin/newsletter": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 5.5L19.5 7" />
    </svg>
  ),
};

/** Exact match for the dashboard, prefix match for every other section. */
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminChrome({
  items,
  userName,
  children,
}: {
  items: NavItem[];
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current =
    items.find((item) => isActive(pathname, item.href)) ?? items[0];
  const initial = userName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="admin-shell">
      <aside className="ax-sidebar">
        <Link href="/admin" className="ax-brand">
          <span className="ax-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path
                d="M24 5c5 6 14 6.5 19 3-1.5 7.5 2.5 15 9.5 17.5-7 2.5-11 10-9.5 17.5-5-3.5-14-3-19 2.5-5-5.5-14-6-19-2.5C17.5 41 13.5 33.5 6.5 31 13.5 28.5 17.5 21 16 13.5c5 3.5 14 3 19-3Z"
                fill="currentColor"
                opacity="0.14"
              />
              <path
                d="M24 9.5c3.7 4.5 10.5 4.9 14.3 2.3-1.1 5.6 1.9 11.3 7.1 13.1-5.2 1.9-8.3 7.5-7.1 13.1-3.8-2.6-10.6-2.2-14.3 1.9-3.7-4.1-10.5-4.5-14.3-1.9 1.2-5.6-1.9-11.2-7.1-13.1 5.2-1.8 8.2-7.5 7.1-13.1 3.8 2.6 10.6 2.2 14.3-2.3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="24" cy="24" r="4.4" fill="currentColor" />
            </svg>
          </span>
          <span className="ax-brand-name">Girah</span>
          <span className="ax-brand-caption">ADMIN CONSOLE</span>
        </Link>

        <p className="ax-nav-label">MENU</p>
        <nav aria-label="Admin" className="ax-nav-list">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`ax-nav-item${isActive(pathname, item.href) ? " is-active" : ""}`}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {ICONS[item.href]}
              <span className="ax-nav-text">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="ax-side-bottom">
          <div className="ax-made-note">
            <span className="ax-note-flower" aria-hidden="true">
              ✿
            </span>
            <span>
              <strong>Girah Admin</strong>
              <small>Cream &amp; sage console</small>
            </span>
          </div>
          <div className="ax-profile-mini">
            <span className="ax-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="ax-profile-copy">
              <strong>{userName}</strong>
              <small>Store administrator</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="ax-main">
        <header className="ax-topbar">
          <p className="ax-crumb">
            <span>Admin</span>
            <span className="ax-crumb-sep" aria-hidden="true">
              /
            </span>
            <strong>{current.label}</strong>
          </p>
          <div className="ax-topbar-actions">
            <span className="ax-meta">
              <span className="ax-live-mark" aria-hidden="true" />
              LIVE · UPDATED ON LOAD
            </span>
            <span className="ax-topbar-divider" aria-hidden="true" />
            <span className="ax-user-chip">
              <span className="ax-avatar" aria-hidden="true">
                {initial}
              </span>
              <span>{userName}</span>
            </span>
          </div>
        </header>

        {/* The page shell supplies the <main id="main-content"> wrapper. */}
        {children}
      </div>
    </div>
  );
}
