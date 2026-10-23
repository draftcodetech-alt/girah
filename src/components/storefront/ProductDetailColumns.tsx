"use client";

import { useState } from "react";
import type { ProductDetail } from "@/modules/catalog";
import { ProductGallery } from "./ProductGallery";
import { PurchasePanel } from "./PurchasePanel";

/**
 * Gallery + purchase panel must agree on the selected variation: picking one
 * swaps the gallery to that variation's own images (first = main). Variations
 * without photos fall back to the product images, so the page is unchanged
 * until real photos are uploaded.
 */
export function ProductDetailColumns({
  product,
  wishlisted,
  isLoggedIn,
}: {
  product: ProductDetail;
  wishlisted?: boolean;
  isLoggedIn?: boolean;
}) {
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const selected = product.variations.find((v) => v.id === selectedVariationId) ?? null;
  const variationImages = selected?.images ?? [];
  const galleryImages = variationImages.length > 0 ? variationImages : product.images;

  return (
    <div className="flex flex-col lg:flex-row gap-12">
      <div className="lg:w-[60%]">
        {/* Keyed by variation so the gallery resets to image 1 on every switch. */}
        <ProductGallery
          key={selectedVariationId ?? product.id}
          images={galleryImages}
          alt={product.name}
        />
      </div>
      <div className="lg:w-[40%]">
        <PurchasePanel
          product={product}
          wishlisted={wishlisted}
          isLoggedIn={isLoggedIn}
          onVariationChange={setSelectedVariationId}
        />
      </div>
    </div>
  );
}
