import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { register, updateProfile } from "@/modules/accounts/actions";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 L1 + L2: case-variant emails must never create twin accounts, and
// the create/update unique races (pre-check bypassed by a concurrent submit)
// must return friendly field errors instead of a P2002 500.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signIn: vi.fn(async () => undefined),
}));

const REGISTER = (email: string) => ({
  name: "Case Tester",
  email,
  password: "password123",
  confirmPassword: "password123",
});

describe("register email normalization (L1)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  it("stores the email trimmed and lowercased", async () => {
    const result = await register(REGISTER("  Mixed.Case@Example.COM "));
    expect(result.success).toBe(true);

    const user = await db.user.findUnique({ where: { email: "mixed.case@example.com" } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe("mixed.case@example.com");
  });

  it("refuses a case-variant duplicate as a friendly field error", async () => {
    const first = await register(REGISTER("alice@example.com"));
    expect(first.success).toBe(true);

    const dup = await register(REGISTER("ALICE@Example.com"));
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.fieldErrors?.email).toMatch(/already associated/i);

    const count = await db.user.count({
      where: { email: { equals: "alice@example.com", mode: "insensitive" } },
    });
    expect(count).toBe(1);
  });
});

describe("register P2002 race (L2)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  it("returns the same friendly field error when the pre-check is raced", async () => {
    await db.user.create({
      data: { name: "Racer", email: "race@example.com", passwordHash: "hash" },
    });

    // Simulate the TOCTOU window: a concurrent submit slipped past findFirst.
    vi.spyOn(db.user, "findFirst").mockResolvedValueOnce(null);

    const result = await register(REGISTER("race@example.com"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.email).toMatch(/already associated/i);
  });

  it("rethrows non-P2002 failures untouched", async () => {
    vi.spyOn(db.user, "findFirst").mockResolvedValueOnce(null);
    vi.spyOn(db.user, "create").mockRejectedValueOnce(new Error("connection lost"));

    await expect(register(REGISTER("anything@example.com"))).rejects.toThrow("connection lost");
  });
});

describe("updateProfile (L1 + L2)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
    authMock.mockReset();
  });

  it("writes the normalized email", async () => {
    const user = await createTestUser({ email: "old@example.com" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await updateProfile({
      name: "Renamed",
      email: "  NEW.Email@Example.COM ",
      phone: "",
    });
    expect(result.success).toBe(true);

    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.email).toBe("new.email@example.com");
    expect(fresh.name).toBe("Renamed");
  });

  it("refuses a case-variant email already used by another account", async () => {
    const user = await createTestUser({ email: "me@example.com" });
    await db.user.create({
      data: { name: "Other", email: "taken@example.com", passwordHash: "hash" },
    });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await updateProfile({ name: "Me", email: "TAKEN@example.com", phone: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.email).toMatch(/already in use/i);
  });

  it("returns a friendly field error when the update hits the unique race", async () => {
    const user = await createTestUser({ email: "me2@example.com" });
    await db.user.create({
      data: { name: "Other", email: "raced@example.com", passwordHash: "hash" },
    });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    vi.spyOn(db.user, "findFirst").mockResolvedValueOnce(null);

    const result = await updateProfile({ name: "Me", email: "raced@example.com", phone: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.email).toMatch(/already in use/i);
  });
});
