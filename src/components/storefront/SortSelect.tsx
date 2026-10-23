"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Public sort list (by request): only the two price orders — "Featured" and
// "Newest" were removed from the shop UI. The default is price-asc so the
// select always matches what the page actually applies.
const SORT_OPTIONS = [
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
];

export function SortSelect({ basePath = "/shop" }: { basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Normalize anything else (?sort=featured, ?sort=newest, junk) to the
  // default — same rule the pages apply, so display and order can't diverge.
  const currentSort = searchParams.get("sort") === "price-desc" ? "price-desc" : "price-asc";

  return (
    <select
      aria-label="Sort products"
      value={currentSort}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", e.target.value);
        // Re-sorting reshuffles the whole list — start back at page 1.
        params.delete("page");
        router.push(`${basePath}?${params.toString()}`);
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
