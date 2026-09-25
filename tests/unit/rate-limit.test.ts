import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  recordFailure,
  resetRateLimit,
  pruneRateLimits,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_WINDOW_MS,
} from "@/lib/rate-limit";

// Phase 4 M3: the in-memory throttle behind Auth.js authorize(). Keys live in
// a module-global Map, so each test uses a fresh budget (or a unique key) to
// stay independent of file/loop ordering.

beforeEach(() => {
  // Far-future "now" marks every bucket expired -> full sweep.
  pruneRateLimits(Number.MAX_SAFE_INTEGER);
});

describe("recordFailure / isRateLimited", () => {
  it("does not block a fresh key", () => {
    expect(isRateLimited("fresh|1.1.1.1", { now: 1000 })).toBe(false);
  });

  it(`blocks only after ${DEFAULT_MAX_ATTEMPTS} failures`, () => {
    const now = 1_000;
    const key = "exhaust|2.2.2.2";
    for (let i = 0; i < DEFAULT_MAX_ATTEMPTS; i++) {
      expect(isRateLimited(key, { now })).toBe(false);
      const limited = recordFailure(key, { now });
      expect(limited).toBe(i + 1 >= DEFAULT_MAX_ATTEMPTS);
    }
    expect(isRateLimited(key, { now })).toBe(true);
    // The NEXT attempt is rejected before any further failures are recorded.
    expect(isRateLimited(key, { now })).toBe(true);
  });

  it("honours a custom max", () => {
    const now = 2_000;
    const key = "custom|3.3.3.3";
    expect(recordFailure(key, { now, max: 2 })).toBe(false);
    expect(isRateLimited(key, { now, max: 2 })).toBe(false);
    expect(recordFailure(key, { now, max: 2 })).toBe(true);
    expect(isRateLimited(key, { now, max: 2 })).toBe(true);
  });

  it("reopens the key once the window expires", () => {
    const t0 = 3_000;
    const key = "expiry|4.4.4.4";
    for (let i = 0; i < DEFAULT_MAX_ATTEMPTS; i++) recordFailure(key, { now: t0 });
    expect(isRateLimited(key, { now: t0 })).toBe(true);

    const afterWindow = t0 + DEFAULT_WINDOW_MS;
    expect(isRateLimited(key, { now: afterWindow })).toBe(false);

    // A post-expiry failure starts a brand-new window at count 1.
    expect(recordFailure(key, { now: afterWindow })).toBe(false);
    expect(isRateLimited(key, { now: afterWindow })).toBe(false);
  });

  it("resetRateLimit clears a burned budget (successful login)", () => {
    const now = 4_000;
    const key = "reset|5.5.5.5";
    for (let i = 0; i < DEFAULT_MAX_ATTEMPTS; i++) recordFailure(key, { now });
    expect(isRateLimited(key, { now })).toBe(true);

    resetRateLimit(key);
    expect(isRateLimited(key, { now })).toBe(false);
  });

  it("isolates keys from each other", () => {
    const now = 5_000;
    for (let i = 0; i < DEFAULT_MAX_ATTEMPTS; i++) recordFailure("blocked|6.6.6.6", { now });
    expect(isRateLimited("blocked|6.6.6.6", { now })).toBe(true);
    expect(isRateLimited("other-user|6.6.6.6", { now })).toBe(false);
    expect(isRateLimited("blocked|7.7.7.7", { now })).toBe(false);
  });
});

describe("pruneRateLimits", () => {
  it("removes only expired buckets", () => {
    const t0 = 6_000;
    recordFailure("keep|8.8.8.8", { now: t0 });
    recordFailure("stale|8.8.8.8", { now: t0 - DEFAULT_WINDOW_MS - 1 });

    const removed = pruneRateLimits(t0);
    expect(removed).toBe(1);
    expect(isRateLimited("keep|8.8.8.8", { now: t0 })).toBe(false);
    // The stale bucket is gone entirely (it would have expired anyway).
    expect(isRateLimited("stale|8.8.8.8", { now: t0 })).toBe(false);
  });
});
