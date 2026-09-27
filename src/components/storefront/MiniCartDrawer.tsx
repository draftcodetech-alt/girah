"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

export type MiniCartItem = {
  name: string;
  variationName: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
};

type MiniCartDrawerProps = {
  open: boolean;
  item: MiniCartItem | null;
  onClose: () => void;
};

/**
 * Success = mini-cart drawer, no navigation away (design spec): right-side
 * drawer on desktop, bottom sheet on mobile, with View Cart /
 * Continue Shopping actions. Focus is trapped in the dialog (close button
 * receives focus; Escape closes; backdrop click closes).
 */
export function MiniCartDrawer({ open, item, onClose }: MiniCartDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !item) return null;

  const lineTotal = item.unitPrice * item.quantity;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="mini-cart-title">
      <div
        className="absolute inset-0 bg-charcoal/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-[var(--radius-panel)] border-t border-border bg-cream shadow-[var(--shadow-elevated)] flex flex-col focus:outline-none md:inset-y-0 md:left-auto md:right-0 md:bottom-auto md:h-full md:w-[400px] md:max-h-none md:rounded-none md:rounded-l-[var(--radius-panel)] md:border-t-0 md:border-l"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 id="mini-cart-title" className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
            Added to cart
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart drawer"
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

        <p role="status" className="sr-only">
          Added {item.quantity} × {item.name} to your cart.
        </p>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex gap-4">
            <div className="relative w-[72px] aspect-4/5 shrink-0 overflow-hidden rounded-[var(--radius-surface)] bg-sage-light">
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-body text-body font-medium text-charcoal">{item.name}</p>
              <p className="font-body text-small text-muted mt-1">{item.variationName}</p>
              <p className="font-body text-small text-muted mt-1">
                {item.quantity} × {formatPrice(item.unitPrice)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-body text-small text-muted">Subtotal</span>
            <span className="font-body text-body font-semibold text-charcoal">
              {formatPrice(lineTotal)}
            </span>
          </div>
          <Link
            href="/cart"
            className="w-full h-12 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold uppercase tracking-[0.02em] hover:bg-charcoal transition-colors"
          >
            View Cart
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-sage-light text-charcoal font-body text-button font-semibold uppercase tracking-[0.02em] hover:bg-sage-light/70 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
