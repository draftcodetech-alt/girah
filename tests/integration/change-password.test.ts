import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { changePassword } from "@/modules/accounts/actions";
import { getFreshAccount } from "@/lib/account-guard";
import { resetDb, createTestUser } from "../setup/helpers";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
}));

const OLD_PASSWORD = "OldPassword123!";

async function seedUser() {
  return createTestUser({
    email: "pw-change@girah.test",
    passwordHash: await bcrypt.hash(OLD_PASSWORD, 4),
  });
}

describe("changePassword", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("refuses without a session", async () => {
    authMock.mockResolvedValue(null);
    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "NewPassword123!",
      confirmNewPassword: "NewPassword123!",
    });
    expect(result).toEqual({ success: false, error: "You must be signed in." });
  });

  it("rejects a wrong current password without touching the hash or version", async () => {
    const user = await seedUser();
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await changePassword({
      currentPassword: "NotThePassword1!",
      newPassword: "NewPassword123!",
      confirmNewPassword: "NewPassword123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.currentPassword).toBe("Current password is incorrect.");
    }
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.sessionVersion).toBe(before.sessionVersion);
    expect(await bcrypt.compare(OLD_PASSWORD, after.passwordHash)).toBe(true);
  });

  it("refuses a too-short new password before any password check", async () => {
    const user = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "short",
      confirmNewPassword: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.newPassword).toMatch(/at least 8 characters/i);
    }
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(OLD_PASSWORD, fresh.passwordHash)).toBe(true);
  });

  it("refuses mismatched confirmation (schema refine)", async () => {
    const user = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "NewPassword123!",
      confirmNewPassword: "DifferentPassword1!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.confirmNewPassword).toBe("Passwords do not match");
    }
  });

  it("changes the password and bumps sessionVersion, killing live sessions", async () => {
    const user = await seedUser();
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.sessionVersion).toBe(0);
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "BrandNewPass456!",
      confirmNewPassword: "BrandNewPass456!",
    });
    expect(result.success).toBe(true);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("BrandNewPass456!", after.passwordHash)).toBe(true);
    expect(await bcrypt.compare(OLD_PASSWORD, after.passwordHash)).toBe(false);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);

    const fresh = await getFreshAccount(user.id);
    expect(fresh?.sessionVersion).toBe(before.sessionVersion + 1);
  });

  it("does not touch other accounts", async () => {
    const user = await seedUser();
    const bystander = await createTestUser({ email: "bystander@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "BrandNewPass456!",
      confirmNewPassword: "BrandNewPass456!",
    });
    expect(result.success).toBe(true);

    const other = await db.user.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(other.sessionVersion).toBe(0);
    expect(other.passwordHash).toBe(bystander.passwordHash);
  });

  it("answers 'Account not found.' for a deleted account", async () => {
    const user = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    await db.user.delete({ where: { id: user.id } });

    const result = await changePassword({
      currentPassword: OLD_PASSWORD,
      newPassword: "BrandNewPass456!",
      confirmNewPassword: "BrandNewPass456!",
    });
    expect(result).toEqual({ success: false, error: "Account not found." });
  });
});
