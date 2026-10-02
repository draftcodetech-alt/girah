import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrderById, getMyOrders } from "@/modules/orders/queries";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 M5: the confirmation page must not leak customer name/address/
// items across users. Account orders require the OWNING session; guest
// orders stay cuid-bearer (no account exists to own them).

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-SCO${Date.now()}${orderCounter}`,
      customerName: "Scope Tester",
      customerEmail: "scope@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 12",
      shippingCity: "Islamabad",
      subtotal: 25_000,
      total: 25_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

describe("getOrderById scoping", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("serves a guest order to the link holder (cuid bearer), no session needed", async () => {
    authMock.mockResolvedValue(null);
    const order = await seedOrder();

    const view = await getOrderById(order.id);
    expect(view).not.toBeNull();
    expect(view?.id).toBe(order.id);
  });

  it("serves an account order to its owner", async () => {
    const owner = await createTestUser({ email: "owner-view@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOrder({ userId: owner.id });

    const view = await getOrderById(order.id);
    expect(view).not.toBeNull();
    expect(view?.customerName).toBe("Scope Tester");
  });

  it("returns null for a logged-in STRANGER", async () => {
    const owner = await createTestUser({ email: "owner-view2@girah.test" });
    authMock.mockResolvedValue({ user: { id: "someone-else", role: "CUSTOMER" } });
    const order = await seedOrder({ userId: owner.id });

    expect(await getOrderById(order.id)).toBeNull();
  });

  it("returns null for an account order with NO session", async () => {
    const owner = await createTestUser({ email: "owner-view3@girah.test" });
    authMock.mockResolvedValue(null);
    const order = await seedOrder({ userId: owner.id });

    expect(await getOrderById(order.id)).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    authMock.mockResolvedValue(null);
    expect(await getOrderById("no-such-order")).toBeNull();
  });
});

describe("getMyOrders scoping", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("returns [] without a session", async () => {
    authMock.mockResolvedValue(null);
    await seedOrder({ userId: (await createTestUser({ email: "mo@girah.test" })).id });
    expect(await getMyOrders()).toEqual([]);
  });

  it("returns only the caller's orders, newest first", async () => {
    const owner = await createTestUser({ email: "owner-mo@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });

    const older = await seedOrder({ userId: owner.id, createdAt: new Date("2026-01-01") });
    const newer = await seedOrder({ userId: owner.id, createdAt: new Date("2026-06-01") });

    const list = await getMyOrders();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
    expect(list[1].id).toBe(older.id);
  });

  it("excludes other users' and guest orders", async () => {
    const owner = await createTestUser({ email: "owner-mo2@girah.test" });
    const stranger = await createTestUser({ email: "stranger-mo@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });

    await seedOrder({ userId: owner.id });
    await seedOrder({ userId: stranger.id });
    await seedOrder(); // guest order — userId null

    const list = await getMyOrders();
    expect(list).toHaveLength(1);
    expect(list[0].customerName).toBe("Scope Tester");
    const ids = await db.order.findMany({ select: { userId: true } });
    expect(new Set(ids.map((o) => o.userId))).toEqual(new Set([owner.id, stranger.id, null]));
  });
});
