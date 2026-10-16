import { describe, it, expect } from "vitest";
import { sanitizeFilters } from "@/modules/catalog";

// LIKE-special escape (frontend QA finding): Prisma passes % and _ through
// to LIKE unescaped — live-verified "%" matched every product row — so a
// symbol-only query returned the whole catalog instead of nothing.
describe("sanitizeFilters search escaping", () => {
  it("escapes LIKE specials so symbol queries match literally", () => {
    expect(sanitizeFilters({ search: "%_%" }).search).toBe("\\%\\_\\%");
    expect(sanitizeFilters({ search: "100%" }).search).toBe("100\\%");
    expect(sanitizeFilters({ search: "a_b\\c" }).search).toBe("a\\_b\\\\c");
  });

  it("leaves normal queries untouched", () => {
    expect(sanitizeFilters({ search: "  Rose Bouquet  " }).search).toBe("Rose Bouquet");
    expect(sanitizeFilters({}).search).toBeUndefined();
    expect(sanitizeFilters({ search: "   " }).search).toBe("");
  });
});
