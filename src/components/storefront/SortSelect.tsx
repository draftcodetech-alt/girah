"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "featured";

  return (
    <select
      value={currentSort}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", e.target.value);
        router.push(`/shop?${params.toString()}`);
      }}
      className="font-body text-body h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          Sort: {opt.label}
        </option>
      ))}
    </select>
  );
}
