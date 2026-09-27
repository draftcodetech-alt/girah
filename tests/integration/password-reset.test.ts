import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requestPasswordReset, resetPassword } from "@/modules/accounts/actions";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 14: forgot/reset password — hashed single-use tokens, generic
// anti-enumeration responses, per-address rate limiting, and session
// invalidation on success.

let seq = 0;
const uniqueEmail = () => `pwreset-${Date.now()}-${seq++}@girah.test`;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Inserts a token the way the action would, but with a known raw value. */
async function seedToken(userId: string, raw: string, expiresAt: Date) {
  return db.passwordResetToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("requestPasswordReset", () => {
  it("stores a hashed token with a 1-hour expiry for a known account", async () => {
    const user = await createTestUser();
    const result = await requestPasswordReset({ email: user.email });
    expect(result.success).toBe(true);

    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const ttl = rows[0].expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000 + 5_000);
  });

  it("answers an unknown address with the identical success and no token", async () => {
    const known = await createTestUser();
    const knownResult = await requestPasswordReset({ email: known.email });
    const unknownResult = await requestPasswordReset({ email: uniqueEmail() });
    expect(knownResult.success).toBe(true);
    expect(JSON.stringify(unknownResult)).toBe(JSON.stringify(knownResult));
    expect(await db.passwordResetToken.count()).toBe(1); // only the known user's
  });

  it("matches the account case-insensitively", async () => {
    const user = await createTestUser({ email: "CaseReset@Girah.test" });
    const result = await requestPasswordReset({ email: "casereset@girah.test" });
    expect(result.success).toBe(true);
    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });

  it("keeps only the newest link alive", async () => {
    const user = await createTestUser();
    await requestPasswordReset({ email: user.email });
    await requestPasswordReset({ email: user.email });
    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });

  it("rejects a malformed email as a field error", async () => {
    const result = await requestPasswordReset({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.email).toBeTruthy();
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  it("rate-limits one address after five requests", async () => {
    const email = uniqueEmail();
    const outcomes: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const result = await requestPasswordReset({ email });
      if (!result.success) expect(result.error).toContain("Too many reset requests");
      outcomes.push(result.success);
    }
    expect(outcomes).toEqual([true, true, true, true, true, false]);
  });
});

describe("resetPassword", () => {
  it("updates the password, consumes every token and bumps sessionVersion", async () => {
    const oldHash = await bcrypt.hash("OldPass123!", 10);
    const user = await createTestUser({ passwordHash: oldHash });
    const raw = crypto.randomBytes(32).toString("hex");
    await seedToken(user.id, raw, new Date(Date.now() + 60 * 60 * 1000));

    const result = await resetPassword({
      token: raw,
      password: "NewPass456!",
      confirmPassword: "NewPass456!",
    });
    expect(result.success).toBe(true);

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    expect(updated.passwordHash).not.toBe(oldHash);
    expect(await bcrypt.compare("NewPass456!", updated.passwordHash)).toBe(true);
    expect(await bcrypt.compare("OldPass123!", updated.passwordHash)).toBe(false);
    expect(await db.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses an unknown token with the generic error", async () => {
    const result = await resetPassword({
      token: crypto.randomBytes(32).toString("hex"),
      password: "Whatever123!",
      confirmPassword: "Whatever123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This reset link is invalid or has expired.");
  });

  it("refuses an expired token without consuming the session", async () => {
    const user = await createTestUser();
    const raw = crypto.randomBytes(32).toString("hex");
    await seedToken(user.id, raw, new Date(Date.now() - 1000));
    const result = await resetPassword({
      token: raw,
      password: "Whatever123!",
      confirmPassword: "Whatever123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This reset link is invalid or has expired.");
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.sessionVersion).toBe(user.sessionVersion);
    // The expired row stays until the next request replaces it (hash is dead
    // anyway) — but it must never be usable.
    expect(await db.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it("cannot reuse a token after a successful reset", async () => {
    const user = await createTestUser();
    const raw = crypto.randomBytes(32).toString("hex");
    await seedToken(user.id, raw, new Date(Date.now() + 60 * 60 * 1000));
    const first = await resetPassword({
      token: raw,
      password: "NewPass456!",
      confirmPassword: "NewPass456!",
    });
    expect(first.success).toBe(true);

    const second = await resetPassword({
      token: raw,
      password: "Another789!",
      confirmPassword: "Another789!",
    });
    expect(second.success).toBe(false);
    if (!second.success) expect(second.error).toBe("This reset link is invalid or has expired.");
  });

  it("rejects a password that does not confirm", async () => {
    const result = await resetPassword({
      token: crypto.randomBytes(32).toString("hex"),
      password: "NewPass456!",
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Please check the highlighted fields.");
      expect(result.fieldErrors?.confirmPassword).toBeTruthy();
    }
  });

  it("rejects a short password", async () => {
    const result = await resetPassword({
      token: crypto.randomBytes(32).toString("hex"),
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.password).toBeTruthy();
  });

  it("rejects a blank token as a field error", async () => {
    const result = await resetPassword({
      token: "",
      password: "NewPass456!",
      confirmPassword: "NewPass456!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.token).toBeTruthy();
  });
});
