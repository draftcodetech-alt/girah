import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cancelMyOrder } from "@/modules/orders/actions";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 12: customer self-service cancel — UNPAID orders only, owner-scoped
// with the same anti-enumeration rule as the rest of the orders module, and
// a restock audit trail attributed to NO admin (adminId: null = customer).

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MISSING_ERROR = "Order not found.";

let orderCounter = 0;
async function seedOwnedOrder(
  owner: { id: string },
  overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}
) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-CXL${Date.now()}${orderCounter}`,
      userId: owner.id,
      customerName: "Cancel Tester",
      customerEmail: "cancel@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 3",
      shippingCity: "Islamabad",
      subtotal: 100_000,
      total: 100_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

async function seedItem(orderId: string, variationId: string, quantity: number) {
  const variation = await db.productVariation.findUniqueOrThrow({ where: { id: variationId } });
  const product = await db.product.findUniqueOrThrow({ where: { id: variation.productId } });
  return db.orderItem.create({
    data: {
      orderId,
      variationId,
      productName: product.name,
      variationName: variation.name,
      unitPrice: variation.price,
      quantity,
      subtotal: variation.price * quantity,
    },
  });
}

describe("cancelMyOrder", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("requires a session", async () => {
    authMock.mockResolvedValue(null);
    const owner = await createTestUser();
    const order = await seedOwnedOrder(owner);

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("You must be signed in.");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus).toBe("PENDING");
  });

  it("returns the SAME not-found error for a stranger's order and a missing id", async () => {
    const owner = await createTestUser({ email: "owner-cancel@girah.test" });
    const stranger = await createTestUser({ email: "stranger-cancel@girah.test" });
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);

    const strangerResult = await cancelMyOrder(order.id);
    const missingResult = await cancelMyOrder("definitely-not-an-order");
    expect(strangerResult.success).toBe(false);
    expect(missingResult.success).toBe(false);
    if (!strangerResult.success) expect(strangerResult.error).toBe(MISSING_ERROR);
    if (!missingResult.success) expect(missingResult.error).toBe(MISSING_ERROR);

    // …and the order itself is untouched.
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus).toBe("PENDING");
  });

  it("lets the owner cancel an unpaid PENDING order: restock + customer audit row", async () => {
    const owner = await createTestUser({ email: "owner-cancel2@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const p1 = await createTestProduct(); // stock 5
    const p2 = await createTestProduct();
    const order = await seedOwnedOrder(owner);
    await seedItem(order.id, p1.variation.id, 2);
    await seedItem(order.id, p2.variation.id, 1);
    // placeOrderCore decrements stock — simulate that here (5 → 3 / 5 → 4).
    await db.productVariation.update({ where: { id: p1.variation.id }, data: { stock: 3 } });
    await db.productVariation.update({ where: { id: p2.variation.id }, data: { stock: 4 } });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(true);

    const cancelled = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(cancelled.orderStatus).toBe("CANCELLED");
    expect(cancelled.paymentStatus).toBe("PENDING");

    expect((await db.productVariation.findUniqueOrThrow({ where: { id: p1.variation.id } })).stock).toBe(5);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: p2.variation.id } })).stock).toBe(5);

    const rows = await db.stockAdjustment.findMany({ orderBy: { variationId: "asc" } });
    expect(rows).toHaveLength(2);
    // adminId: NULL is the "customer cancelled" convention (never an admin id).
    expect(rows.every((r) => r.adminId === null)).toBe(true);
    expect(rows.every((r) => r.reason.includes(order.orderNumber))).toBe(true);
    expect(rows.every((r) => r.reason.includes("cancelled by customer"))).toBe(true);
  });

  it("lets the owner cancel a CONFIRMED unpaid order", async () => {
    const owner = await createTestUser({ email: "owner-cancel3@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner, { orderStatus: "CONFIRMED" });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus).toBe("CANCELLED");
  });

  it("refuses a PROCESSING order — already being prepared", async () => {
    const owner = await createTestUser({ email: "owner-cancel4@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner, { orderStatus: "PROCESSING" });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already being prepared/);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus).toBe("PROCESSING");
  });

  it("refuses a PAID order — never a customer refund path", async () => {
    const owner = await createTestUser({ email: "owner-cancel5@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner, { paymentStatus: "PAID" });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already been paid/);
    const unchanged = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.paymentStatus).toBe("PAID");
    expect(unchanged.orderStatus).toBe("PENDING");
    expect(await db.stockAdjustment.count()).toBe(0);
  });

  it("refuses an already-CANCELLED order with a distinct message", async () => {
    const owner = await createTestUser({ email: "owner-cancel6@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner, { orderStatus: "CANCELLED" });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This order has already been cancelled.");
    expect(await db.stockAdjustment.count()).toBe(0);
  });

  it("refuses a DELIVERED order", async () => {
    const owner = await createTestUser({ email: "owner-cancel7@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner, { orderStatus: "DELIVERED", paymentStatus: "PAID" });

    const result = await cancelMyOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This order has already been delivered.");
  });
});
