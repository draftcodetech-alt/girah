"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateVariation, adjustStock } from "@/modules/admin";
import { formatPrice } from "@/lib/format";

type Variation = {
  id: string;
  name: string;
  price: number;
  stock: number;
  isEnabled: boolean;
  product: { name: string };
};

export function VariationRow({ variation }: { variation: Variation }) {
  const [isPending, startTransition] = useTransition();
  const [showAdjust, setShowAdjust] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEnabled() {
    setError(null);
    startTransition(async () => {
      const result = await updateVariation(variation.id, {
        name: variation.name,
        price: variation.price,
        isEnabled: !variation.isEnabled,
      });
      if (!result.success) setError(result.error);
    });
  }

  function handleAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await adjustStock(variation.id, {
        adjustment: Number(formData.get("adjustment")),
        reason: formData.get("reason") as string,
      });
      if (result.success) {
        setShowAdjust(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="py-4 border-b border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-body font-medium text-charcoal">
            {variation.product.name} — {variation.name}
          </p>
          <p className="font-body text-small text-muted mt-1">
            {formatPrice(variation.price)} · Stock: {variation.stock}
            {!variation.isEnabled && <span className="text-error"> · Disabled</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdjust((s) => !s)}
            className="font-body text-small text-sage font-medium"
          >
            Adjust Stock
          </button>
          <button
            onClick={toggleEnabled}
            disabled={isPending}
            className="font-body text-small text-charcoal underline"
          >
            {variation.isEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {showAdjust && (
        <form onSubmit={handleAdjust} className="mt-4 flex items-end gap-3 bg-sage-light p-4 rounded-[var(--radius-control)]">
          <div>
            <label className="font-body text-small text-charcoal block mb-1">Adjustment</label>
            <input
              name="adjustment"
              type="number"
              placeholder="e.g. 5 or -3"
              required
              className="h-10 w-32 rounded-[var(--radius-control)] border border-border px-3 font-body text-body bg-cream"
            />
          </div>
          <div className="flex-1">
            <label className="font-body text-small text-charcoal block mb-1">Reason</label>
            <input
              name="reason"
              placeholder="e.g. Restock"
              required
              className="h-10 w-full rounded-[var(--radius-control)] border border-border px-3 font-body text-body bg-cream"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 px-4 rounded-[var(--radius-control)] bg-sage text-cream font-body text-small font-semibold"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {error && <p role="alert" className="font-body text-small text-error mt-2">{error}</p>}
    </div>
  );
}