import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";
import { refundSafepayPayment } from "@/modules/payments/safepay";
import { getAdminOrders, getAdminOrderById, getDashboardMetrics } from "@/modules/admin";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 13: the new admin ops — order filters and dashboard aggregations.
// The standalone Refund and the stock audit feed were removed as spec
// changes; the cancel-path refund is covered by refund-cancel.test.ts.

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-test-id", role: "ADMIN" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/payments/safepay", () => ({
  refundSafepayPayment: vi.fn(),
  createSafepayCheckoutUrl: vi.fn(),
  SafepayRefundError: class SafepayRefundError extends Error {},
}));

let seq = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  seq += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-P13${Date.now()}${seq}`,
      customerName: "Phase Thirteen",
      customerEmail: `p13-${seq}@girah.test`,
      customerPhone: "03001112223",
      shippingAddress: "Street 13",
      shippingCity: "Islamabad",
      subtotal: 10_000,
      total: 10_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

async function freshOrder(id: string) {
  return db.order.findUniqueOrThrow({ where: { id } });
}


beforeEach(async () => {
  await resetDb();
  vi.mocked(requireAdmin).mockClear();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(refundSafepayPayment).mockReset().mockResolvedValue(undefined);
});

describe("getAdminOrders filters", () => {
  beforeEach(async () => {
    await seedOrder({ orderNumber: "GIR-SHIP001", orderStatus: "SHIPPED", customerEmail: "ship@girah.test" });
    await seedOrder({ orderNumber: "GIR-CANCEL01", orderStatus: "CANCELLED", customerName: "Cancel Person" });
    await seedOrder({ orderNumber: "GIR-Lower001", orderStatus: "PENDING" });
  });

  it("returns only the requested status, newest first", async () => {
    const rows = await getAdminOrders({ status: "SHIPPED" });
    expect(rows).toHaveLength(1);
    expect(rows[0].orderNumber).toBe("GIR-SHIP001");
    expect(rows[0].orderStatus).toBe("SHIPPED");
  });

  it("ignores an unknown status value instead of erroring or returning nothing", async () => {
    const rows = await getAdminOrders({ status: "NOT_A_STATUS" });
    expect(rows).toHaveLength(3);
  });

  it("search matches order number, customer name and email, case-insensitively", async () => {
    expect((await getAdminOrders({ search: "gir-ship" })).map((r) => r.orderNumber)).toEqual(["GIR-SHIP001"]);
    expect((await getAdminOrders({ search: "cancel person" }))).toHaveLength(1);
    expect((await getAdminOrders({ search: "SHIP@GIRAH" }))).toHaveLength(1);
    expect(await getAdminOrders({ search: "no-match-here" })).toHaveLength(0);
  });

  it("status and search combine (narrowing, not OR-ing)", async () => {
    expect(await getAdminOrders({ status: "SHIPPED", search: "cancel" })).toHaveLength(0);
    expect(await getAdminOrders({ status: "CANCELLED", search: "cancel" })).toHaveLength(1);
  });

  it("trims surrounding whitespace out of the search term", async () => {
    expect((await getAdminOrders({ search: "   gir-ship   " }))).toHaveLength(1);
    expect(await getAdminOrders({ search: "   " })).toHaveLength(3); // blank = no filter
  });

  it("each row carries its items for the admin list", async () => {
    const rows = await getAdminOrders({});
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => Array.isArray(row.items))).toBe(true);
  });
});

describe("updateOrderStatus revalidation", () => {
  it("refreshes both the list and the detail page after a legal transition", async () => {
    const order = await seedOrder({ orderStatus: "SHIPPED" });
    const { updateOrderStatus } = await import("@/modules/admin/orders");

    const result = await updateOrderStatus(order.id, { orderStatus: "DELIVERED" });
    expect(result.success).toBe(true);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/orders");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/admin/orders/${order.id}`);
    expect((await freshOrder(order.id)).orderStatus).toBe("DELIVERED");
  });
});

describe("getAdminOrderById", () => {
  it("joins items and the customer account, or null for unknown ids", async () => {
    const user = await createTestUser();
    const { variation } = await createTestProduct();
    const order = await seedOrder({ userId: user.id });
    await db.orderItem.create({
      data: {
        orderId: order.id,
        variationId: variation.id,
        productName: "Bouquet",
        variationName: "Test Variation",
        unitPrice: 100_000,
        quantity: 1,
        subtotal: 100_000,
      },
    });

    const found = await getAdminOrderById(order.id);
    expect(found).not.toBeNull();
    expect(found!.items).toHaveLength(1);
    expect(found!.user).toMatchObject({ id: user.id, email: user.email });

    expect(await getAdminOrderById("nope")).toBeNull();
  });
});

describe("getDashboardMetrics", () => {
  it("revenue30 counts PAID totals only; the 14-day series excludes non-PAID", async () => {
    const now = Date.now();
    await seedOrder({ paymentStatus: "PAID", total: 10_000 }); // today
    await seedOrder({ paymentStatus: "PAID", total: 5_000 }); // today
    await seedOrder({ paymentStatus: "PENDING", total: 7_000 }); // today
    await seedOrder({
      paymentStatus: "REFUNDED",
      total: 9_000,
      createdAt: new Date(now - 20 * 86_400_000),
    }); // in window, but not revenue
    await seedOrder({
      paymentStatus: "PAID",
      total: 3_300,
      createdAt: new Date(now - 40 * 86_400_000),
    }); // outside the window

    const metrics = await getDashboardMetrics();
    expect(metrics.revenue30).toBe(15_000);
    expect(metrics.orders30).toBe(4);
    expect(metrics.series).toHaveLength(14);
    expect(metrics.series[13].revenue).toBe(15_000); // today: PAID only
    expect(metrics.series[12].revenue).toBe(0);
    expect(metrics.recentOrders.length).toBeLessThanOrEqual(8);
  });

  it("ordersByStatus is zero-filled across all six statuses", async () => {
    await seedOrder({ orderStatus: "SHIPPED" });
    await seedOrder({ orderStatus: "SHIPPED" });
    await seedOrder({ orderStatus: "CANCELLED" });

    const { ordersByStatus } = await getDashboardMetrics();
    expect(ordersByStatus.map((row) => row.status)).toEqual([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]);
    expect(Object.fromEntries(ordersByStatus.map((row) => [row.status, row.count]))).toMatchObject({
      SHIPPED: 2,
      CANCELLED: 1,
      PENDING: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      DELIVERED: 0,
    });
  });

  it("counts pending reviews and customers created in the window", async () => {
    const { product } = await createTestProduct();
    const customer = await createTestUser();
    await db.review.create({
      data: { productId: product.id, userId: customer.id, rating: 5, text: "Lovely", status: "PENDING" },
    });
    const { product: other } = await createTestProduct();
    await db.review.create({
      data: {
        productId: other.id,
        userId: customer.id,
        rating: 4,
        text: "Fine",
        status: "APPROVED",
      },
    });

    const metrics = await getDashboardMetrics();
    expect(metrics.pendingReviews).toBe(1);
    expect(metrics.customers30).toBe(1);
  });

  it("recent orders are newest-first and capped at 8", async () => {
    for (let i = 0; i < 10; i++) {
      await seedOrder({ createdAt: new Date(Date.now() + i * 1_000) });
    }
    const metrics = await getDashboardMetrics();
    expect(metrics.recentOrders).toHaveLength(8);
    const times = metrics.recentOrders.map((order) => order.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(metrics.recentOrders[0].orderNumber.startsWith("GIR-P13")).toBe(true);
  });
});
