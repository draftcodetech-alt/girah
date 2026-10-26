"use client";

import { useState, useTransition } from "react";
import { updateVariation } from "@/modules/admin";
import { formatPrice } from "@/lib/format";
import { VariationForm } from "./VariationForm";
import { ImageManager } from "./ImageManager";

type Variation = {
  id: string;
  name: string;
  price: number;
  isEnabled: boolean;
  product: { name: string };
  // Supplied by the product edit page; the catalog page's per-product list
  // passes it too (image management lives with the product it belongs to).
  images?: { id: string; url: string; sortOrder: number }[];
};

export function VariationRow({ variation }: { variation: Variation }) {
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showImages, setShowImages] = useState(false);
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

  return (
    <div className="py-4 border-b border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-body font-medium text-charcoal">
            {variation.product.name} — {variation.name}
          </p>
          <p className="font-body text-small text-muted mt-1">
            {formatPrice(variation.price)}
            {!variation.isEnabled && <span className="text-error"> · Disabled</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowEdit((s) => !s);
              setShowImages(false);
            }}
            className="font-body text-small text-sage font-medium"
          >
            {showEdit ? "Close" : "Edit"}
          </button>
          {variation.images !== undefined && (
            <button
              onClick={() => {
                setShowImages((s) => !s);
                setShowEdit(false);
              }}
              className="font-body text-small text-sage font-medium"
            >
              {showImages ? "Close" : "Images"}
            </button>
          )}
          <button
            onClick={toggleEnabled}
            disabled={isPending}
            className="font-body text-small text-charcoal underline"
          >
            {variation.isEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {showEdit && (
        <VariationForm
          variation={{
            id: variation.id,
            name: variation.name,
            price: variation.price,
            isEnabled: variation.isEnabled,
          }}
          onDone={() => setShowEdit(false)}
        />
      )}

      {showImages && variation.images !== undefined && (
        <div className="mt-4 bg-sage-light p-4 rounded-[var(--radius-control)]">
          <p className="font-body text-small text-charcoal mb-3">
            {variation.name} — shown when this variation is selected on the product page.
          </p>
          <ImageManager
            variationId={variation.id}
            productName={`${variation.product.name} — ${variation.name}`}
            images={variation.images}
          />
        </div>
      )}
      {error && <p role="alert" className="font-body text-small text-error mt-2">{error}</p>}
    </div>
  );
}
