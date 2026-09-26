"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";

type MenuLink = { label: string; href: string };

export function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="h-10 w-10 inline-flex items-center justify-center rounded-[var(--radius-control)] text-charcoal hover:bg-sage-light focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute right-0 top-12 z-30 w-64 rounded-[var(--radius-panel)] border border-border bg-cream p-4 shadow-[var(--shadow-elevated)] flex flex-col gap-3"
        >
          <form method="GET" action="/shop" className="pb-3 border-b border-border">
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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-body text-body text-charcoal hover:text-sage py-1"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
