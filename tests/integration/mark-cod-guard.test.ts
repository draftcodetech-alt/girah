import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { markCodPaymentReceived } from "@/modules/admin/orders";
import { resetDb } from "../setup/helpers";

// Phase 4 M2: "Mark Paid" is a manual override of a payment state — it may
// only perform the live PENDING -> PAID transition on a non-cancelled COD
// order, as a CAS, never resurrect PAID/REFUNDED/CANCELLED rows.

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-test-id", role: "ADMIN" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-COD${Date.now()}${orderCounter}`,
      customerName: "COD Tester",
      customerEmail: "cod@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 9",
      shippingCity: "Islamabad",
      subtotal: 10_000,
      total: 10_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

async function paymentStatus(id: string) {
  return (await db.order.findUniqueOrThrow({ where: { id } })).paymentStatus;
}

describe("markCodPaymentReceived guards", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks a live COD PENDING order paid", async () => {
    const order = await seedOrder();
    const result = await markCodPaymentReceived(order.id);
    expect(result.success).toBe(true);
    expect(await paymentStatus(order.id)).toBe("PAID");
  });

  it("refuses an already-PAID order", async () => {
    const order = await seedOrder({ paymentStatus: "PAID" });
    const result = await markCodPaymentReceived(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already PAID/i);
    expect(await paymentStatus(order.id)).toBe("PAID");
  });

  it("refuses a REFUNDED order — a refund must never read as paid again", async () => {
    const order = await seedOrder({ paymentStatus: "REFUNDED" });
    const result = await markCodPaymentReceived(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already REFUNDED/i);
    expect(await paymentStatus(order.id)).toBe("REFUNDED");
  });

  it("refuses a CANCELLED order even while payment is PENDING", async () => {
    const order = await seedOrder({ orderStatus: "CANCELLED" });
    const result = await markCodPaymentReceived(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/cancelled/i);
    expect(await paymentStatus(order.id)).toBe("PENDING");
  });

  it("refuses non-COD orders and unknown ids", async () => {
    const safepay = await seedOrder({ paymentMethod: "SAFEPAY" });
    const nonCod = await markCodPaymentReceived(safepay.id);
    expect(nonCod.success).toBe(false);
    if (!nonCod.success) expect(nonCod.error).toMatch(/cash on delivery/i);

    const missing = await markCodPaymentReceived("no-such-order");
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error).toBe("Order not found.");
  });

  it("CAS: loses the race when the row changed between read and write", async () => {
    const order = await seedOrder();

    // The pre-read still sees PENDING, but the row flips before updateMany.
    vi.spyOn(db.order, "findUnique").mockResolvedValueOnce({
      ...(await db.order.findUniqueOrThrow({ where: { id: order.id } })),
    });
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });

    const result = await markCodPaymentReceived(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/reload/i);
    expect(await paymentStatus(order.id)).toBe("REFUNDED");
    vi.restoreAllMocks();
  });
});
