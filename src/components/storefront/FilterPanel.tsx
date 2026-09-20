"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function FilterPanel({ onApply }: { onApply?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [inStockOnly, setInStockOnly] = useState(searchParams.get("inStockOnly") === "true");

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    minPrice ? params.set("minPrice", minPrice) : params.delete("minPrice");
    maxPrice ? params.set("maxPrice", maxPrice) : params.delete("maxPrice");
    inStockOnly ? params.set("inStockOnly", "true") : params.delete("inStockOnly");
    router.push(`/shop?${params.toString()}`);
    onApply?.();
  }

  function clear() {
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("minPrice");
    params.delete("maxPrice");
    params.delete("inStockOnly");
    router.push(`/shop?${params.toString()}`);
    onApply?.();
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage">
          Price
        </h3>
        <div className="flex items-center gap-3 mt-3">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-3 font-body text-body"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-3 font-body text-body"
          />
        </div>
        <p className="font-body text-small text-muted mt-1">In rupees, e.g. 800</p>
      </div>

      <div>
        <h3 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage">
          Availability
        </h3>
        <label className="flex items-center gap-2 mt-3 font-body text-body text-charcoal">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-sage"
          />
          In Stock
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={clear}
          className="font-body text-button font-semibold h-12 px-6 rounded-[var(--radius-control)] bg-sage-light text-charcoal"
        >
          Clear
        </button>
        <button
          onClick={apply}
          className="font-body text-button font-semibold h-12 px-6 rounded-[var(--radius-control)] bg-sage text-cream"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
