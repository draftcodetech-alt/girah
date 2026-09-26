import { describe, it, expect } from "vitest";
import { formatDate } from "@/lib/format";

// Phase 7: naive toLocaleDateString() rendered a different calendar day on a
// UTC host than a PK visitor saw (19:30Z = 00:30 PK next day). formatDate pins
// Asia/Karachi so "Placed ..."/"Joined ..." are stable wherever the app runs.
// en-GB short months are 3 letters, except September -> "Sept" (CLDR).

describe("formatDate", () => {
  it("rolls a late-UTC instant into the next PK day (the old bug)", () => {
    // 25 Sep 19:30 UTC -> 26 Sep 00:30 PK. A UTC toLocaleDateString says 25 Sep.
    expect(formatDate(new Date("2026-09-25T19:30:00Z"))).toBe("26 Sept 2026");
  });

  it("rolls exactly on the PK midnight boundary", () => {
    // 23:59 PK (18:59Z) vs 00:00 PK next day (19:00Z).
    expect(formatDate(new Date("2026-10-26T18:59:00Z"))).toBe("26 Oct 2026");
    expect(formatDate(new Date("2026-10-26T19:00:00Z"))).toBe("27 Oct 2026");
  });

  it("renders as D MMM(M) YYYY", () => {
    expect(formatDate(new Date("2026-01-01T06:00:00Z"))).toMatch(
      /^\d{1,2} [A-Z][a-z]{2,3} \d{4}$/
    );
    expect(formatDate(new Date("1999-12-31T12:00:00Z"))).toBe("31 Dec 1999");
  });

  it("is stable across the year (English month abbreviations)", () => {
    expect(formatDate(new Date("2026-03-15T12:00:00Z"))).toBe("15 Mar 2026");
    expect(formatDate(new Date("2026-11-30T12:00:00Z"))).toBe("30 Nov 2026");
  });
});
