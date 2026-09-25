import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { toggleCustomerActive } from "@/modules/admin/customers";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 L3: the customers list filters role: CUSTOMER, but the action is
// invokable by raw id — it must never disable an ADMIN account (including
// the calling admin disabling itself by accident).

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-test-id", role: "ADMIN" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("toggleCustomerActive role guard", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("toggles a CUSTOMER account (and bumps sessionVersion)", async () => {
    const customer = await createTestUser({ email: "customer-toggle@girah.test" });

    const first = await toggleCustomerActive(customer.id);
    expect(first.success).toBe(true);
    let fresh = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(fresh.isActive).toBe(false);
    expect(fresh.sessionVersion).toBe(1);

    const second = await toggleCustomerActive(customer.id);
    expect(second.success).toBe(true);
    fresh = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(fresh.isActive).toBe(true);
    expect(fresh.sessionVersion).toBe(2);
  });

  it("refuses to disable an ADMIN account", async () => {
    const admin = await createTestUser({
      email: "admin-target@girah.test",
      role: "ADMIN",
    });

    const result = await toggleCustomerActive(admin.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/admin accounts cannot be disabled/i);

    const fresh = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(fresh.isActive).toBe(true);
    expect(fresh.sessionVersion).toBe(0);
  });

  it("refuses unknown ids with the existing not-found error", async () => {
    const result = await toggleCustomerActive("no-such-user");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });
});
