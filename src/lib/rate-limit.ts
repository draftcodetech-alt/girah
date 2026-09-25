// Phase 4 M3: minimal in-memory login throttle. Every credentials login —
// app form or raw /api/auth — passes through Auth.js `authorize()`, so the
// choke point lives there and this module only holds the counter logic.
//
// Scope note: buckets are per-process (module-level Map). This deployment is
// a single `next start` process, so that is the correct scope; a shared store
// (Redis etc.) would only matter behind multiple instances and is out of
// scope for the bug-fix phases.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type Options = {
  max?: number;
  windowMs?: number;
  now?: number; // injectable clock so tests are deterministic
};

/** True when `key` has already burned through its failure budget. */
export function isRateLimited(key: string, opts: Options = {}): boolean {
  const now = opts.now ?? Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (bucket.resetAt <= now) {
    buckets.delete(key);
    return false;
  }
  return bucket.count >= (opts.max ?? DEFAULT_MAX_ATTEMPTS);
}

/**
 * Counts one failed attempt against `key` (opening a fresh window on the
 * first failure) and returns whether the key is now exhausted.
 */
export function recordFailure(key: string, opts: Options = {}): boolean {
  const now = opts.now ?? Date.now();
  const max = opts.max ?? DEFAULT_MAX_ATTEMPTS;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + (opts.windowMs ?? DEFAULT_WINDOW_MS) });
    if (buckets.size > 1000) pruneRateLimits(now);
    return 1 >= max;
  }

  bucket.count += 1;
  if (buckets.size > 1000) pruneRateLimits(now);
  return bucket.count >= max;
}

/** Clears a key's budget — call on successful authentication. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Drops expired buckets; returns how many were removed (also used by tests). */
export function pruneRateLimits(now: number = Date.now()): number {
  let removed = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
      removed++;
    }
  }
  return removed;
}
