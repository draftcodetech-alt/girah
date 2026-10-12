import { describe, it, expect, beforeEach, vi } from "vitest";
import { encode } from "@auth/core/jwt";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { readSessionFromCookieJar } from "@/lib/session";
import { login, logout, changePassword, resetPassword } from "@/modules/accounts/actions";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 1 integration: the session guard end-to-end, minus HTTP.
//
// Only next/headers (the cookie jar) and the three transport-bound auth
// exports are doubled — `handlers` stays REAL, so every session read below
// runs Auth.js's own /api/auth/session pipeline: decode → the app's jwt
// callback (DB re-check of isActive + sessionVersion) → session callback.
// That is the exact code path that has to reject a cookie from before a
// sessionVersion bump; asserting the bump alone would not prove it.

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
}));
const authMock = vi.hoisted(() => vi.fn());
const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.jar.has(name) ? { name, value: state.jar.get(name) as string } : undefined,
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      state.jar.set(name, value);
    },
    delete: (name: string) => {
      state.jar.delete(name);
    },
  }),
  headers: async () => new Headers({ host: "localhost:3100", "x-forwarded-proto": "http" }),
}));

// Partial double: auth()/signIn()/signOut() cannot run without a request
// scope, but handlers (and therefore the session endpoint) must stay real.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, auth: authMock, signIn: signInMock, signOut: signOutMock };
});

// Auth.js may name the cookie with or without the __Secure- prefix depending
// on the configured site URL — mint both so the jar matches whichever the
// real handler decodes with.
const COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET / NEXTAUTH_SECRET is not set for the test run.");
  return secret;
}

/** Writes a real Auth.js session cookie for `user`, exactly as sign-in would. */
async function mintSessionCookie(user: {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  sessionVersion: number;
}) {
  const token = {
    name: user.name,
    email: user.email,
    picture: null,
    sub: user.id,
    id: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
  for (const salt of COOKIE_NAMES) {
    state.jar.set(salt, await encode({ token, secret: authSecret(), salt }));
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const PASSWORD = "SessionGuard123!";

beforeEach(async () => {
  await resetDb();
  state.jar.clear();
  authMock.mockReset().mockResolvedValue(null);
  signOutMock.mockReset().mockResolvedValue(undefined);
  signInMock.mockReset().mockImplementation(async () => {
    // A credentials login only leaves a cookie when the password is right —
    // so `login()` can still fail closed in these tests.
    const args = signInMock.mock.calls[0] as unknown as [
      string,
      { email: string; password: string },
    ];
    const user = await db.user.findUnique({ where: { email: args[1].email } });
    if (!user) return undefined;
    const ok = await bcrypt.compare(args[1].password, user.passwordHash);
    if (ok) await mintSessionCookie(user);
    return undefined;
  });
});

describe("login → logout → old session cookie", () => {
  it("accepts the cookie issued at login, then rejects it after logout bumps the version", async () => {
    const user = await createTestUser({
      email: "guard-login@girah.test",
      name: "Guard Login",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });

    const signedIn = await login({ email: user.email, password: PASSWORD });
    expect(signedIn).toEqual({ success: true });

    // The cookie Auth.js just wrote is live…
    expect(await readSessionFromCookieJar()).toMatchObject({ id: user.id, email: user.email });

    // …until logout bumps sessionVersion for the account.
    authMock.mockResolvedValue({ user: { id: user.id, role: user.role } });
    await logout();
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/" });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion
    ).toBe(1);

    // The cookie from BEFORE logout must now be rejected by the jwt callback.
    expect(await readSessionFromCookieJar()).toBeNull();
  });

  it("rejects the wrong password outright (no cookie is ever written)", async () => {
    const user = await createTestUser({
      email: "guard-wrong@girah.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });

    const result = await login({ email: user.email, password: "NotThePassword1!" });

    expect(result.success).toBe(false);
    expect(state.jar.size).toBe(0);
    expect(await readSessionFromCookieJar()).toBeNull();
  });

  it("a cookie minted at the NEW version is accepted (the rejection is version-based)", async () => {
    const user = await createTestUser({
      email: "guard-remint@girah.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });
    await login({ email: user.email, password: PASSWORD });
    expect(await readSessionFromCookieJar()).not.toBeNull();

    authMock.mockResolvedValue({ user: { id: user.id, role: user.role } });
    await logout();

    expect(await readSessionFromCookieJar()).toBeNull();

    // Re-authenticating at the bumped version works — the guard is not a wall.
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    await mintSessionCookie(fresh);
    expect(await readSessionFromCookieJar()).toMatchObject({ id: user.id });
  });
});

describe("changePassword kills other sessions", () => {
  it("a device signed in before the password change is logged out with it", async () => {
    const user = await createTestUser({
      email: "guard-change@girah.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });

    // "Another device": a live session cookie at sessionVersion 0.
    await mintSessionCookie(user);
    expect(await readSessionFromCookieJar()).not.toBeNull();

    authMock.mockResolvedValue({ user: { id: user.id, role: user.role } });
    const result = await changePassword({
      currentPassword: PASSWORD,
      newPassword: "BrandNewGuard456!",
      confirmNewPassword: "BrandNewGuard456!",
    });
    expect(result.success).toBe(true);

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion
    ).toBe(1);
    // Same cookie, same process — it is dead now.
    expect(await readSessionFromCookieJar()).toBeNull();
    // The new password really did replace the old one.
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("BrandNewGuard456!", fresh.passwordHash)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, fresh.passwordHash)).toBe(false);
  });

  it("does not touch a bystander account's live session", async () => {
    const user = await createTestUser({
      email: "guard-bystander-self@girah.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });
    const bystander = await createTestUser({ email: "guard-bystander@girah.test" });
    await mintSessionCookie(bystander);

    authMock.mockResolvedValue({ user: { id: user.id, role: user.role } });
    expect(
      (
        await changePassword({
          currentPassword: PASSWORD,
          newPassword: "BrandNewGuard456!",
          confirmNewPassword: "BrandNewGuard456!",
        })
      ).success
    ).toBe(true);

    expect(await readSessionFromCookieJar()).toMatchObject({ id: bystander.id });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: bystander.id } })).sessionVersion
    ).toBe(0);
  });
});

describe("resetPassword rotates the session", () => {
  it("consuming the reset link invalidates sessions issued before it", async () => {
    const user = await createTestUser({ email: "guard-reset@girah.test" });
    const raw = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3_600_000) },
    });

    // Live session from before the reset.
    await mintSessionCookie(user);
    expect(await readSessionFromCookieJar()).not.toBeNull();

    const result = await resetPassword({
      token: raw,
      password: "ResetGuard789!",
      confirmPassword: "ResetGuard789!",
    });
    expect(result.success).toBe(true);

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion
    ).toBe(1);
    expect(await readSessionFromCookieJar()).toBeNull(); // cookie died with it

    // Single-use: the same link is gone for good.
    const replay = await resetPassword({
      token: raw,
      password: "AnotherGuess456!",
      confirmPassword: "AnotherGuess456!",
    });
    expect(replay.success).toBe(false);
    if (!replay.success) {
      expect(replay.error).toBe("This reset link is invalid or has expired.");
    }
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion
    ).toBe(1); // failed replay never rotates again
  });

  it("an expired link neither changes the password nor rotates the session", async () => {
    const user = await createTestUser({ email: "guard-expired@girah.test" });
    const raw = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() - 1_000) },
    });
    await mintSessionCookie(user);

    const result = await resetPassword({
      token: raw,
      password: "ShouldNotWork1!",
      confirmPassword: "ShouldNotWork1!",
    });

    expect(result.success).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(0);
    expect(await readSessionFromCookieJar()).not.toBeNull(); // still signed in
  });
});
