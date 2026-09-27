"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ProductDetail } from "@/modules/catalog";
import { addToCart } from "@/modules/cart/actions";
import { formatPrice } from "@/lib/format";
import { WishlistButton } from "./WishlistButton";
import { Accordion } from "./Accordion";
import { MiniCartDrawer, type MiniCartItem } from "./MiniCartDrawer";

export function PurchasePanel({ product, wishlisted }: { product: ProductDetail; wishlisted?: boolean }) {
  const purchasableVariations = product.variations.filter((v) => v.isEnabled);
  const allOutOfStock = product.variations.every((v) => !v.isEnabled || v.stock <= 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<MiniCartItem | null>(null);
  const [atcOutOfView, setAtcOutOfView] = useState(false);
  const atcRef = useRef<HTMLButtonElement>(null);

  const selected = product.variations.find((v) => v.id === selectedId);
  // Phase 5 "Rs. Infinity": Math.min() over an EMPTY purchasable set is
  // +Infinity — with zero enabled variations the price line used to render
  // literally "From Rs. Infinity". Null → render "Unavailable" instead.
  const lowestPrice =
    purchasableVariations.length > 0 ? Math.min(...purchasableVariations.map((v) => v.price)) : null;

  // Mobile sticky add-to-cart: visible once the main button scrolls away.
  useEffect(() => {
    const button = atcRef.current;
    if (!button || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtcOutOfView(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  function selectVariation(id: string) {
    setSelectedId(id);
    setQuantity(1);
    setFeedback(null);
  }

  const canAddToCart = !!selected && selected.isEnabled && selected.stock > 0 && !isPending;

  function handleAddToCart() {
    if (!selected) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await addToCart(selected.id, quantity);
      if (result.success) {
        // Spec: success = mini-cart drawer, never navigate away.
        setDrawerItem({
          name: product.name,
          variationName: selected.name,
          quantity,
          unitPrice: selected.price,
          imageUrl: product.images[0]?.url,
        });
        setDrawerOpen(true);
      } else {
        setFeedback({ type: "error", message: result.error });
      }
    });
  }

  return (
    <div className="lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal max-w-[360px]">
          {product.name}
        </h1>
        <WishlistButton productId={product.id} wishlisted={wishlisted} size="lg" />
      </div>
      <p className="font-body text-card-title text-sage mt-4">
        {selected
          ? formatPrice(selected.price)
          : lowestPrice !== null
          ? `From ${formatPrice(lowestPrice)}`
          : "Unavailable"}
      </p>

      <div className="mt-8">
        <h3 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage">
          Variation
        </h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {product.variations.map((v) => {
            const isOutOfStock = !v.isEnabled || v.stock <= 0;
            const isSelected = v.id === selectedId;
            return (
              <button
                key={v.id}
                disabled={isOutOfStock}
                onClick={() => selectVariation(v.id)}
                aria-pressed={isSelected}
                className={`font-body text-body h-12 px-4 rounded-[var(--radius-control)] border transition-colors ${
                  isOutOfStock
                    ? "border-border text-placeholder cursor-not-allowed line-through"
                    : isSelected
                    ? "bg-sage text-cream border-sage"
                    : "border-border text-charcoal hover:border-sage"
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage">
          Quantity
        </h3>
        <div className="flex items-center h-12 w-[144px] mt-3 rounded-[var(--radius-control)] border border-border">
          <button
            aria-label="Decrease quantity"
            disabled={!selected || quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex-1 h-full disabled:text-placeholder text-charcoal"
          >
            −
          </button>
          <span className="font-body text-body px-3">{quantity}</span>
          <button
            aria-label="Increase quantity"
            disabled={!selected || quantity >= (selected?.stock ?? 0)}
            onClick={() => setQuantity((q) => Math.min(selected?.stock ?? 1, q + 1))}
            className="flex-1 h-full disabled:text-placeholder text-charcoal"
          >
            +
          </button>
        </div>
      </div>

      <button
        ref={atcRef}
        disabled={!canAddToCart}
        onClick={handleAddToCart}
        className="w-full h-12 mt-8 rounded-[var(--radius-control)] font-body text-button font-semibold uppercase tracking-[0.02em] bg-sage text-cream disabled:bg-sage-light disabled:text-muted disabled:cursor-not-allowed"
      >
        {allOutOfStock ? "Out of Stock" : isPending ? "Adding..." : "Add to Cart"}
      </button>

      {/* Baymard: total-cost estimate near the buy action. Shipping is
          always 0 (Order.shipping @default(0)) — checkout shows FREE. */}
      <p className="font-body text-small text-muted mt-3">Free shipping on all orders.</p>

      {feedback && feedback.type === "error" && (
        <p role="alert" className="font-body text-small mt-3 text-error">
          {feedback.message}
        </p>
      )}

      <div className="mt-10">
        <Accordion title="Description" defaultOpen>
          <p className="leading-relaxed">{product.description}</p>
        </Accordion>
        <Accordion title="Details">
          <dl className="space-y-2">
            <div className="flex gap-2">
              <dt className="font-medium text-charcoal">Category:</dt>
              <dd>{product.category.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-charcoal">Variations:</dt>
              <dd>
                <ul className="mt-1 space-y-1">
                  {product.variations.map((v) => (
                    <li key={v.id}>
                      {v.name} — {formatPrice(v.price)}
                      {!v.isEnabled || v.stock <= 0
                        ? " (Out of stock)"
                        : ` (${v.stock} in stock)`}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </Accordion>
      </div>

      {/* Mobile sticky add-to-cart — research: keeps the buy action reachable
          past the fold on long product pages. Hidden on lg (panel is sticky). */}
      {atcOutOfView && (
        <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-border bg-cream px-4 py-3 shadow-[var(--shadow-subtle)]">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-body text-small font-medium text-charcoal truncate">
                {product.name}
              </p>
              <p className="font-body text-small text-sage">
                {selected ? formatPrice(selected.price) : lowestPrice !== null ? `From ${formatPrice(lowestPrice)}` : "Unavailable"}
              </p>
            </div>
            <button
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              className="h-12 px-6 shrink-0 rounded-[var(--radius-control)] font-body text-button font-semibold uppercase tracking-[0.02em] bg-sage text-cream disabled:bg-sage-light disabled:text-muted disabled:cursor-not-allowed"
            >
              {allOutOfStock ? "Out of Stock" : isPending ? "Adding..." : "Add to Cart"}
            </button>
          </div>
        </div>
      )}

      <MiniCartDrawer open={drawerOpen} item={drawerItem} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
