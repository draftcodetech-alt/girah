"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProductForm } from "./ProductForm";
import { VariationRow } from "./VariationRow";
import { VariationForm } from "./VariationForm";
import { ProductDeleteButton } from "./ProductDeleteButton";
import { isOptimizableImageUrl } from "@/lib/image";
import { formatPrice } from "@/lib/format";

type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: { name: string };
  images: { url: string }[];
  variations: { id: string; name: string; price: number; isEnabled: boolean }[];
};

/**
 * One row of the merged Catalog page: the product's identity + price range,
 * with three inline expansions so products, categories and variations all
 * live on ONE screen (owner spec) —
 *   Edit       → the existing ProductForm (name / slug / description /
 *                category select = "place them in categories")
 *   Variations → this product's VariationRow list + VariationForm
 *   Images     → deep link to /admin/products/[id] (unchanged upload flow)
 */
export function CatalogProductRow({
  product,
  categories,
}: {
  product: CatalogProduct;
  categories: { id: string; name: string }[];
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showVariations, setShowVariations] = useState(false);

  const enabledPrices = product.variations.filter((v) => v.isEnabled).map((v) => v.price);
  const priceRange =
    enabledPrices.length === 0
      ? "No enabled variations"
      : enabledPrices.length === 1
      ? formatPrice(enabledPrices[0])
      : `${formatPrice(Math.min(...enabledPrices))} – ${formatPrice(Math.max(...enabledPrices))}`;

  const cover = product.images[0]?.url ?? null;

  return (
    <div className="py-4 border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {cover && isOptimizableImageUrl(cover) ? (
            <Image
              src={cover}
              alt={product.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-[var(--radius-control)] object-cover bg-sage-light shrink-0"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-14 h-14 rounded-[var(--radius-control)] bg-sage-light shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-body text-body font-medium text-charcoal truncate">{product.name}</p>
            <p className="font-body text-small text-muted mt-1">
              {product.category.name} · {product.variations.length} variation(s) · {priceRange}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowEdit((s) => !s);
              setShowVariations(false);
            }}
            className="font-body text-small text-sage font-medium"
          >
            {showEdit ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVariations((s) => !s);
              setShowEdit(false);
            }}
            className="font-body text-small text-sage font-medium"
          >
            {showVariations ? "Hide variations" : "Variations"}
          </button>
          <Link
            href={`/admin/products/${product.id}`}
            className="font-body text-small text-sage font-medium"
          >
            Images
          </Link>
          <ProductDeleteButton productId={product.id} productName={product.name} />
        </div>
      </div>

      {showEdit && (
        <div className="mt-4">
          <ProductForm
            categories={categories}
            existingProduct={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              description: product.description,
              categoryId: product.categoryId,
            }}
          />
        </div>
      )}

      {showVariations && (
        <div className="mt-4 bg-sage-light rounded-[var(--radius-surface)] p-4">
          <h4 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-1">
            Variations — {product.name}
          </h4>
          {product.variations.length === 0 ? (
            <p className="font-body text-small text-muted">
              No variations yet — add the first one below.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {product.variations.map((variation) => (
                <VariationRow
                  key={variation.id}
                  variation={{
                    id: variation.id,
                    name: variation.name,
                    price: variation.price,
                    isEnabled: variation.isEnabled,
                    product: { name: product.name },
                  }}
                />
              ))}
            </div>
          )}
          <div className="mt-4">
            <VariationForm productId={product.id} />
          </div>
        </div>
      )}
    </div>
  );
}
