import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthError } from "next-auth";
import { resetDb, createTestUser } from "../setup/helpers";
import { login } from "@/modules/accounts/actions";
import { db } from "@/lib/db";

// Owner spec change (2026-10-24): single-owner store. Sign-in is split into
// two channels — the storefront /login (customer channel, default) and the
// hidden /executive/login door (the only way the one admin can sign in).
// authorize() holds the same rule at the credential choke point; this suite
// proves the login() action's early gate as a real matrix against the real
// database, with only the Auth.js boundary stubbed.

const { signInMock, readSessionMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  readSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: signInMock,
  signOut: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  readSessionFromCookieJar: readSessionMock,
}));

vi.mock("@/modules/cart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/cart")>()),
  mergeGuestCartForCurrentUser: vi.fn(async () => undefined),
}));

describe("login() channel gate (single-owner store)", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let customer: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    await resetDb();
    signInMock.mockReset();
    readSessionMock.mockReset();
    admin = await createTestUser({ email: "owner@girah.test", role: "ADMIN" });
    customer = await createTestUser({ email: "shopper@girah.test", role: "CUSTOMER" });
  });

  it("refuses admin credentials on the storefront channel (channel defaults to customer)", async () => {
    const result = await login({ email: "owner@girah.test", password: "whatever" });
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("refuses admin credentials when the channel is explicitly 'customer'", async () => {
    const result = await login({ email: "owner@girah.test", password: "whatever", channel: "customer" });
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("refuses customer credentials on the executive channel", async () => {
    const result = await login({ email: "shopper@girah.test", password: "whatever", channel: "executive" });
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("refuses an unknown email on the executive channel with the same generic message", async () => {
    // No account to check the role of → falls through to Auth.js, which
    // fails; either way the caller learns nothing about account existence.
    signInMock.mockRejectedValue(new AuthError("CredentialsSignin"));
    const result = await login({ email: "nobody@girah.test", password: "x", channel: "executive" });
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
  });

  it("lets the admin in through the executive channel and proves the session", async () => {
    signInMock.mockResolvedValue(undefined);
    readSessionMock.mockResolvedValue({ id: admin.id, email: "owner@girah.test" });
    const result = await login({ email: "owner@girah.test", password: "correct", channel: "executive" });
    expect(result).toEqual({ success: true });
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "owner@girah.test",
      password: "correct",
      channel: "executive",
      redirect: false,
    });
  });

  it("lets a customer in through the storefront channel and proves the session", async () => {
    signInMock.mockResolvedValue(undefined);
    readSessionMock.mockResolvedValue({ id: customer.id, email: "shopper@girah.test" });
    const result = await login({ email: "shopper@girah.test", password: "correct" });
    expect(result).toEqual({ success: true });
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "shopper@girah.test",
      password: "correct",
      channel: "customer",
      redirect: false,
    });
  });

  it("the channel gate is case-insensitive on email, like the credential check", async () => {
    const result = await login({ email: "OWNER@Girah.TEST", password: "x" });
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("the database itself refuses a second admin (partial unique index)", async () => {
    // The invariant this whole spec rests on, proved live: a second ADMIN
    // row — from any code path — is a database error, not a race we hope
    // nobody runs.
    await expect(
      db.user.create({
        data: {
          email: "second-owner@girah.test",
          name: "Second Owner",
          role: "ADMIN",
          passwordHash: "test-hash",
        },
      })
    ).rejects.toThrow();
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    expect(admins).toBe(1);
  });
});
