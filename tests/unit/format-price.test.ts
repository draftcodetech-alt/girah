import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format";

// Phase 5: the 8 duplicated formatPrice copies produced inconsistent output
// ("Rs. 10.5" vs "Rs. 1,000", Node vs browser Intl defaults could disagree).
// The shared helper must render deterministic 2-decimal rupees everywhere.

describe("formatPrice", () => {
  it("renders zero as Rs. 0.00", () => {
    expect(formatPrice(0)).toBe("Rs. 0.00");
  });

  it("pads sub-rupee paisa to 2 decimals", () => {
    expect(formatPrice(99)).toBe("Rs. 0.99");
    expect(formatPrice(5)).toBe("Rs. 0.05");
  });

  it("shows .50 for half-rupee amounts (the old copy showed Rs. 10.5)", () => {
    expect(formatPrice(1050)).toBe("Rs. 10.50");
  });

  it("groups thousands and keeps 2 decimals", () => {
    expect(formatPrice(100_000)).toBe("Rs. 1,000.00");
    expect(formatPrice(123_456_789)).toBe("Rs. 1,234,567.89");
  });

  it("is a pure function of integer paisa (no locale drift for common values)", () => {
    expect(formatPrice(100)).toBe("Rs. 1.00");
    expect(formatPrice(10)).toBe("Rs. 0.10");
    expect(formatPrice(1)).toBe("Rs. 0.01");
  });
});
