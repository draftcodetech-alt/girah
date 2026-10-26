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
    <div className="py-4">
      <div className="ax-row-head">
        <div className="ax-row-id">
          {cover && isOptimizableImageUrl(cover) ? (
            <Image
              src={cover}
              alt={product.name}
              width={56}
              height={56}
              className="ax-thumb"
            />
          ) : (
            <div aria-hidden="true" className="ax-thumb" />
          )}
          <div className="min-w-0">
            <p className="ax-row-name truncate">{product.name}</p>
            <p className="ax-row-meta">
              {product.category.name} · {product.variations.length} variation(s) · {priceRange}
            </p>
          </div>
        </div>
        <div className="ax-row-actions">
          <button
            type="button"
            onClick={() => {
              setShowEdit((s) => !s);
              setShowVariations(false);
            }}
            className="ax-inline-btn"
          >
            {showEdit ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVariations((s) => !s);
              setShowEdit(false);
            }}
            className="ax-inline-btn"
          >
            {showVariations ? "Hide variations" : "Variations"}
          </button>
          <Link href={`/admin/products/${product.id}`} className="ax-inline-btn">
            Images
          </Link>
          <ProductDeleteButton productId={product.id} productName={product.name} />
        </div>
      </div>

      {showEdit && (
        <div className="ax-row-panel">
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
        <div className="ax-inline-panel">
          <h4 className="ax-kicker">Variations — {product.name}</h4>
          {product.variations.length === 0 ? (
            <p className="ax-row-meta">
              No variations yet — add the first one below.
            </p>
          ) : (
            <div className="divide-y divide-[#e7eade]">
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
