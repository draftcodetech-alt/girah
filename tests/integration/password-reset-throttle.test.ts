import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resetPassword } from "@/modules/accounts/actions";
import { resetRateLimit } from "@/lib/rate-limit";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 1 integration: token-guessing throttle on resetPassword.
//
// The verify throttle is deliberately SKIPPED when NODE_ENV === "test"
// (integration suites hammer the endpoint with bogus tokens), so the live
// behaviour can only be observed by flipping NODE_ENV off "test" around the
// calls — exactly the condition the code checks. The bypass itself is pinned
// below by a source assertion so it can never be removed by accident.

const THROTTLE_MESSAGE = "Too many attempts — please wait a few minutes and try again.";
const INVALID_MESSAGE = "This reset link is invalid or has expired.";

// No request scope in tests: registerRateKey() falls back to "unknown", so
// every caller shares one bucket. Cleared between tests (it is process state,
// not DB state — resetDb() cannot see it).
const VERIFY_KEY = "pwreset-verify:unknown";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function seedToken(userId: string, raw: string, expiresAt = new Date(Date.now() + 3_600_000)) {
  return db.passwordResetToken.create({ data: { userId, tokenHash: sha256(raw), expiresAt } });
}

function bogusToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function tryReset(token: string) {
  return resetPassword({ token, password: "ValidPass123!", confirmPassword: "ValidPass123!" });
}

beforeEach(async () => {
  await resetDb();
  resetRateLimit(VERIFY_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimit(VERIFY_KEY);
});

describe("resetPassword token-guessing throttle", () => {
  it("skips the throttle under NODE_ENV=test by design (source pin)", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/accounts/actions.ts"),
      "utf8"
    );
    expect(source).toContain('process.env.NODE_ENV !== "test"');
    // The bypass must wrap the verify branch, not the whole action.
    const branch = source.slice(source.indexOf("async function resetPassword"));
    expect(branch).toContain('if (process.env.NODE_ENV !== "test")');
    expect(branch).toContain("pwreset-verify:");
  });

  it("lets an unlimited number of bogus tokens through while NODE_ENV is test", async () => {
    for (let i = 0; i < 15; i++) {
      const result = await tryReset(bogusToken());
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe(INVALID_MESSAGE); // never the throttle
    }
  });

  it("returns the throttle message on the 11th rapid guess outside NODE_ENV=test", async () => {
    const email = `throttle-${Date.now()}@girah.test`;
    await createTestUser({ email });

    vi.stubEnv("NODE_ENV", "development");

    const outcomes: string[] = [];
    for (let i = 0; i < 11; i++) {
      const result = await tryReset(bogusToken());
      expect(result.success).toBe(false);
      if (!result.success) outcomes.push(result.error);
    }

    // Attempts 1..10 burn the budget; the 11th is refused before any DB read.
    expect(outcomes.slice(0, 10)).toEqual(Array(10).fill(INVALID_MESSAGE));
    expect(outcomes[10]).toBe(THROTTLE_MESSAGE);

    // Still throttled a moment later (the window is 15 minutes).
    const again = await tryReset(bogusToken());
    expect(again.success).toBe(false);
    if (!again.success) expect(again.error).toBe(THROTTLE_MESSAGE);
  });

  it("keeps accepting a VALID token while the guesser is throttled (fresh email)", async () => {
    const bystander = await createTestUser({ email: `frozen-${Date.now()}@girah.test` });
    const victim = await createTestUser({ email: `victim-${Date.now()}@girah.test` });
    const raw = bogusToken();
    await seedToken(victim.id, raw);

    vi.stubEnv("NODE_ENV", "development");

    // Burn the shared bucket with guesses against a different account.
    for (let i = 0; i < 11; i++) await tryReset(bogusToken());
    expect((await db.user.findUniqueOrThrow({ where: { id: bystander.id } })).sessionVersion).toBe(0);

    // The legitimate owner's link is on a different branch (valid record →
    // no throttle check), so it must still land even mid-throttle.
    const ok = await tryReset(raw);
    expect(ok.success).toBe(true);

    const fresh = await db.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(fresh.sessionVersion).toBe(1);
    expect(await bcrypt.compare("ValidPass123!", fresh.passwordHash)).toBe(true);
    expect(await db.passwordResetToken.count({ where: { userId: victim.id } })).toBe(0);

    // The consumed link cannot be replayed — clear the guess budget first so
    // the assertion proves consumption rather than a still-full throttle.
    resetRateLimit(VERIFY_KEY);
    const replay = await tryReset(raw);
    expect(replay.success).toBe(false);
    if (!replay.success) expect(replay.error).toBe(INVALID_MESSAGE);
  });
});
