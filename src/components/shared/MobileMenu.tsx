"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";

type MenuLink = { label: string; href: string };

/**
 * Mobile navigation — full-screen overlay per the design spec: cream sheet,
 * × close (also Escape), links close on click, background blocked/scroll
 * locked while open.
 */
export function MobileMenu({ primary, secondary }: { primary: MenuLink[]; secondary: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="h-11 w-11 inline-flex items-center justify-center rounded-[var(--radius-control)] text-charcoal hover:bg-sage-light"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 bg-cream flex flex-col focus:outline-none"
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-border">
            <span className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
              Girah
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="h-11 w-11 inline-flex items-center justify-center rounded-[var(--radius-control)] text-charcoal hover:bg-sage-light"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-6 py-8" aria-label="Mobile">
            <ul className="flex flex-col gap-5">
              {primary.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="font-body text-body font-medium text-charcoal hover:text-sage"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <form method="GET" action="/search" className="mt-8 pt-6 border-t border-border">
              <label htmlFor="mobile-menu-search" className="sr-only">
                Search products
              </label>
              <Input
                id="mobile-menu-search"
                type="search"
                name="search"
                placeholder="Search products"
                size="sm"
                autoComplete="off"
              />
            </form>

            <ul className="mt-6 pt-6 border-t border-border flex flex-col gap-5">
              {secondary.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="font-body text-body font-medium text-charcoal hover:text-sage"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
