import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrderById } from "@/modules/orders/queries";
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
