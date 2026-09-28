// Phase 17: storefront pagination. The catalog query still returns the full
// (filtered + sorted) list — price sorting happens in memory — so pagination
// is a pure slice at the very end, in one place.

export const PAGE_SIZE = 12;

/** Coerces a `?page=` query value to a 1-based integer (default 1). */
export function normalizePage(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * Slices `items` for `page`. Out-of-range pages clamp to the last page (a
 * stale bookmark or a filter that shrank the result set must never land on
 * an empty screen) — except an empty list, which is always "page 1 of 1".
 */
export function paginate<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
