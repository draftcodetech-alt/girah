import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { logout } from "@/modules/accounts/actions";
import { getFreshAccount } from "@/lib/account-guard";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 M4: logout must bump sessionVersion BEFORE clearing this browser's
// cookie — a copied/stolen cookie for the same account has to die with it
// instead of surviving (and renewing) for up to 30 days.

const authMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signOut: signOutMock,
}));

describe("logout session invalidation", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
  });

  it("bumps sessionVersion before signing the local cookie out", async () => {
    const user = await createTestUser({ email: "logout@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    let versionAtSignOut: number | null = null;
    signOutMock.mockImplementation(async () => {
      versionAtSignOut = (
        await db.user.findUniqueOrThrow({ where: { id: user.id } })
      ).sessionVersion;
    });

    await logout();

    expect(versionAtSignOut).toBe(1);
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/" });

    // The bumped version no longer matches any token issued at version 0 —
    // getFreshAccount comparisons in the jwt callback now fail (Phase 1 C2).
    const account = await getFreshAccount(user.id);
    expect(account?.sessionVersion).toBe(1);
  });

  it("still signs out even when no session is present", async () => {
    authMock.mockResolvedValue(null);

    await logout();
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("does not touch other accounts", async () => {
    const user = await createTestUser({ email: "keeper@girah.test" });
    const bystander = await createTestUser({ email: "bystander@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    await logout();

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(1);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: bystander.id } })).sessionVersion
    ).toBe(0);
  });
});
