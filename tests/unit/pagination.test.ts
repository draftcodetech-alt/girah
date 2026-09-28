import { describe, it, expect } from "vitest";
import { paginate, normalizePage, PAGE_SIZE } from "@/modules/catalog/pagination";

// Phase 17: storefront pagination — pure functions, so the edge cases (stale
// bookmarks, junk query values, empty result sets) are pinned exactly.

describe("normalizePage", () => {
  it("defaults to 1 for missing or junk values", () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage("")).toBe(1);
    expect(normalizePage("abc")).toBe(1);
    expect(normalizePage("-3")).toBe(1);
    expect(normalizePage("0")).toBe(1);
    expect(normalizePage("1.9")).toBe(1); // parseInt floor
    expect(normalizePage(7)).toBe(1); // non-strings are not trusted
    expect(normalizePage(null)).toBe(1);
  });

  it("keeps valid page numbers", () => {
    expect(normalizePage("1")).toBe(1);
    expect(normalizePage("3")).toBe(3);
    expect(normalizePage("42")).toBe(42);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("slices the first page at PAGE_SIZE", () => {
    const result = paginate(items, 1);
    expect(PAGE_SIZE).toBe(12);
    expect(result.items).toHaveLength(12);
    expect(result.items[0]).toBe(1);
    expect(result.items[11]).toBe(12);
    expect(result.page).toBe(1);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("slices later pages", () => {
    const second = paginate(items, 2);
    expect(second.items).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    const third = paginate(items, 3);
    expect(third.items).toEqual([25]);
    expect(third.totalPages).toBe(3);
  });

  it("clamps a stale out-of-range page to the last page (never an empty screen)", () => {
    const result = paginate(items, 999);
    expect(result.page).toBe(3);
    expect(result.items).toEqual([25]);
  });

  it("clamps page 0 / negatives to page 1", () => {
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -5).page).toBe(1);
  });

  it("treats an empty list as page 1 of 1 with no items", () => {
    const result = paginate([], 4);
    expect(result).toMatchObject({ items: [], page: 1, totalPages: 1, total: 0 });
  });

  it("stays on one page when the list fits exactly", () => {
    const exact = paginate(items.slice(0, 12), 1);
    expect(exact.totalPages).toBe(1);
    expect(exact.items).toHaveLength(12);
    const stale = paginate(items.slice(0, 12), 5);
    expect(stale.page).toBe(1); // clamped, still rendered — not empty
    expect(stale.items).toHaveLength(12);
  });

  it("respects a custom page size", () => {
    const result = paginate(items, 2, 10);
    expect(result.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(result.totalPages).toBe(3);
  });
});
