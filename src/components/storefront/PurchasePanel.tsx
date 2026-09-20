"use client";

import { useState, useTransition } from "react";
import type { ProductDetail } from "@/modules/catalog";
import { addToCart } from "@/modules/cart/actions";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

export function PurchasePanel({ product }: { product: ProductDetail }) {
  const purchasableVariations = product.variations.filter((v) => v.isEnabled);
  const allOutOfStock = product.variations.every((v) => !v.isEnabled || v.stock <= 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selected = product.variations.find((v) => v.id === selectedId);
  const lowestPrice = Math.min(...purchasableVariations.map((v) => v.price));

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
        setFeedback({ type: "success", message: `Added ${quantity} × ${selected.name} to your cart.` });
      } else {
        setFeedback({ type: "error", message: result.error });
      }
    });
  }

  return (
    <div className="lg:sticky lg:top-24">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal max-w-[360px]">
        {product.name}
      </h1>
      <p className="font-body text-card-title text-sage mt-4">
        {selected ? formatPrice(selected.price) : `From ${formatPrice(lowestPrice)}`}
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
        disabled={!canAddToCart}
        onClick={handleAddToCart}
        className="w-full h-12 mt-8 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:bg-sage-light disabled:text-muted disabled:cursor-not-allowed"
      >
        {allOutOfStock ? "Out of Stock" : isPending ? "Adding..." : "Add to Cart"}
      </button>

      {feedback && (
        <p
          className={`font-body text-small mt-3 ${
            feedback.type === "success" ? "text-success" : "text-error"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-12 border-t border-border pt-6">
        <h3 className="font-body text-small font-semibold text-charcoal">Description</h3>
        <p className="font-body text-body text-muted mt-3 leading-relaxed">
          {product.description}
        </p>
      </div>
    </div>
  );
}