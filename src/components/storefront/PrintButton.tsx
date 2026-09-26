"use client";

/**
 * Print triggers `window.print()` — a client-only API, so it must be a
 * component. The receipt page hides its own chrome via `print:hidden`.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage-light text-charcoal print:hidden"
    >
      Print receipt
    </button>
  );
}
