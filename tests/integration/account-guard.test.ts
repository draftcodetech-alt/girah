import { describe, it, expect, beforeEach } from "vitest";
import { getFreshAccount } from "@/lib/account-guard";
import { db } from "@/lib/db";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 1 C2: the jwt callback and requireAdmin() both rely on getFreshAccount
// — this is the choke point that makes a disable/sessionVersion bump take
// effect immediately instead of surviving in a stale 30-day JWT.

describe("getFreshAccount", () => {
  beforeEach(resetDb);

  it("returns fresh authorization state for an active user", async () => {
    const user = await createTestUser();
    const account = await getFreshAccount(user.id);
    expect(account).toEqual({
      isActive: true,
      role: "CUSTOMER",
      sessionVersion: 0,
    });
  });

  it("reflects a disable immediately", async () => {
    const user = await createTestUser();
    await db.user.update({
      where: { id: user.id },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });

    const account = await getFreshAccount(user.id);
    expect(account?.isActive).toBe(false);
    expect(account?.sessionVersion).toBe(1);
  });

  it("reports a sessionVersion bump (stale tokens must be rejected)", async () => {
    const user = await createTestUser();
    expect((await getFreshAccount(user.id))?.sessionVersion).toBe(0);

    // Simulates toggleCustomerActive / changePassword bumping the version.
    await db.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    expect((await getFreshAccount(user.id))?.sessionVersion).toBe(1);
  });

  it("reflects role changes", async () => {
    const user = await createTestUser({ role: "CUSTOMER" });
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    expect((await getFreshAccount(user.id))?.role).toBe("ADMIN");
  });

  it("returns null for deleted users and empty/unknown ids", async () => {
    const user = await createTestUser();
    await db.user.delete({ where: { id: user.id } });

    expect(await getFreshAccount(user.id)).toBeNull();
    expect(await getFreshAccount("")).toBeNull();
    expect(await getFreshAccount("does-not-exist")).toBeNull();
  });
});
