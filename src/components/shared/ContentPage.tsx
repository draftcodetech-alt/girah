import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Phase 17: shared shell for the static content pages (About, Contact,
 * Shipping, Returns, Privacy, Terms) — one heading system, breadcrumbs, and
 * a readable measure. Pages supply their own metadata exports.
 */
export function ContentPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-[720px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal uppercase">
        {title}
      </h1>
      <div className="mt-8 space-y-5 font-body text-body text-charcoal">{children}</div>
    </div>
  );
}

/** Section heading inside a ContentPage — matches the storefront display font. */
export function ContentHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-display)] text-h3 text-charcoal uppercase tracking-[0.04em] pt-6">
      {children}
    </h2>
  );
}

/** Muted note for the [placeholder] markers that must ship visibly. */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return <p className="font-body text-small text-muted italic">{children}</p>;
}
