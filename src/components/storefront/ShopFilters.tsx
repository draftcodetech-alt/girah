"use client";

import { useState } from "react";
import { FilterPanel } from "./FilterPanel";

export function ShopFilters() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — hidden below lg breakpoint (1024px, girah.md §6.9) */}
      <aside className="hidden lg:block w-[260px] shrink-0">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-6">
          Filters
        </h2>
        <FilterPanel />
      </aside>

      {/* Mobile trigger button — hidden at lg and above */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden font-body text-button font-semibold h-12 px-6 rounded-[var(--radius-control)] border border-border bg-cream text-charcoal"
      >
        Filters
      </button>

      {/* Mobile bottom sheet */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-charcoal/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-cream rounded-t-[var(--radius-panel)] shadow-[var(--shadow-elevated)] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
                Filters
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="text-charcoal text-h3">
                ×
              </button>
            </div>
            <FilterPanel onApply={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
