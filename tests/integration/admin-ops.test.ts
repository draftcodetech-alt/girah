import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";
import { refundSafepayPayment } from "@/modules/payments/safepay";
import {
  refundOrderPayment,
  getAdminOrders,
  getAdminOrderById,
  getDashboardMetrics,
  getStockAdjustmentFeed,
} from "@/modules/admin";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 13: the new admin ops — standalone refund (money back, order kept),
// order filters, dashboard aggregations and the stock audit feed.

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

async function auditRows() {
  return db.stockAdjustment.findMany();
}

beforeEach(async () => {
  await resetDb();
  vi.mocked(requireAdmin).mockClear();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(refundSafepayPayment).mockReset().mockResolvedValue(undefined);
});

describe("refundOrderPayment — money back, order kept", () => {
  it("refuses a missing order", async () => {
    const result = await refundOrderPayment("does-not-exist");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Order not found.");
  });

  it("refuses a PENDING payment with an explicit status message", async () => {
    const order = await seedOrder({ paymentStatus: "PENDING" });
    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Only a PAID payment can be refunded/);
      expect(result.error).toContain("PENDING");
    }
    expect((await freshOrder(order.id)).paymentStatus).toBe("PENDING");
  });

  it("refuses an already-refunded payment (never double-refunds)", async () => {
    const order = await seedOrder({ paymentStatus: "REFUNDED" });
    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This payment has already been refunded.");
    expect(refundSafepayPayment).not.toHaveBeenCalled();
  });

  it("COD PAID: flips to REFUNDED, keeps orderStatus, never calls Safepay, never touches stock", async () => {
    const { variation } = await createTestProduct(); // stock 5
    const order = await seedOrder({ paymentStatus: "PAID", orderStatus: "CONFIRMED", total: 4_200 });
    await db.orderItem.create({
      data: {
        orderId: order.id,
        variationId: variation.id,
        productName: "Bouquet",
        variationName: "Test Variation",
        unitPrice: 4_200,
        quantity: 1,
        subtotal: 4_200,
      },
    });

    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(true);

    const fresh = await freshOrder(order.id);
    expect(fresh.paymentStatus).toBe("REFUNDED");
    expect(fresh.orderStatus).toBe("CONFIRMED"); // order kept — not cancelled
    expect(fresh.total).toBe(4_200); // money record unchanged, only the status moves

    expect(refundSafepayPayment).not.toHaveBeenCalled();
    expect(await auditRows()).toHaveLength(0); // no restock on a refund
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/admin/orders/${order.id}`);
    expect(vi.mocked(requireAdmin)).toHaveBeenCalled();
  });

  it("SAFEPAY PAID: refunds the recorded tracker for the full total, then REFUNDED", async () => {
    const order = await seedOrder({
      paymentMethod: "SAFEPAY",
      paymentStatus: "PAID",
      orderStatus: "SHIPPED",
      total: 15_500,
      safepayTracker: "track_p13_refund",
    });

    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(true);

    expect(refundSafepayPayment).toHaveBeenCalledTimes(1);
    expect(refundSafepayPayment).toHaveBeenCalledWith("track_p13_refund", 15_500);

    const fresh = await freshOrder(order.id);
    expect(fresh.paymentStatus).toBe("REFUNDED");
    expect(fresh.orderStatus).toBe("SHIPPED");
    expect(await auditRows()).toHaveLength(0);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/orders");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/admin/orders/${order.id}`);
  });

  it("SAFEPAY PAID without a tracker: refuses and points at the Safepay dashboard, order untouched", async () => {
    const order = await seedOrder({
      paymentMethod: "SAFEPAY",
      paymentStatus: "PAID",
      safepayTracker: null,
    });

    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no Safepay payment reference/);
    expect(refundSafepayPayment).not.toHaveBeenCalled();
    expect((await freshOrder(order.id)).paymentStatus).toBe("PAID");
  });

  it("Safepay API rejects: nothing moves — order stays PAID with no audit rows", async () => {
    vi.mocked(refundSafepayPayment).mockRejectedValueOnce(new Error("gateway said no"));
    const order = await seedOrder({
      paymentMethod: "SAFEPAY",
      paymentStatus: "PAID",
      safepayTracker: "track_p13_fail",
    });

    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Safepay rejected the refund/);

    const fresh = await freshOrder(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.orderStatus).toBe("PENDING");
    expect(await auditRows()).toHaveLength(0);
  });

  it("CAS: refuses when the row changed between read and write", async () => {
    const order = await seedOrder({ paymentStatus: "PAID" });
    vi.spyOn(db.order, "findUnique").mockResolvedValueOnce({
      ...(await db.order.findUniqueOrThrow({ where: { id: order.id } })),
    });
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });

    const result = await refundOrderPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/reload/i);
    expect((await freshOrder(order.id)).paymentStatus).toBe("REFUNDED");
    vi.restoreAllMocks();
  });
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

  it("low stock counts enabled variations at or below the threshold only", async () => {
    const low = await createTestProduct();
    await db.productVariation.update({ where: { id: low.variation.id }, data: { stock: 3 } });
    const disabled = await createTestProduct();
    await db.productVariation.update({
      where: { id: disabled.variation.id },
      data: { stock: 0, isEnabled: false },
    });

    const metrics = await getDashboardMetrics();
    expect(metrics.lowStockCount).toBe(1);
    expect(metrics.lowStockList).toHaveLength(1);
    expect(metrics.lowStockList[0]).toMatchObject({ id: low.variation.id, stock: 3 });
    expect(metrics.lowStockList[0].product.id).toBe(low.product.id);
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

describe("getStockAdjustmentFeed", () => {
  it("returns newest-first with admin attribution, or null for customer cancels", async () => {
    const admin = await createTestUser({ role: "ADMIN", email: "stock-admin@girah.test" });
    const { variation } = await createTestProduct();
    await db.stockAdjustment.create({
      data: {
        variationId: variation.id,
        previousStock: 4,
        adjustment: -1,
        newStock: 3,
        reason: "Manual adjustment",
        adminId: admin.id,
        createdAt: new Date("2026-03-01T10:00:00Z"),
      },
    });
    await db.stockAdjustment.create({
      data: {
        variationId: variation.id,
        previousStock: 3,
        adjustment: 1,
        newStock: 4,
        reason: "Stock restored after customer cancelled order",
        adminId: null,
        createdAt: new Date("2026-03-02T10:00:00Z"),
      },
    });

    const rows = await getStockAdjustmentFeed();
    expect(rows).toHaveLength(2);
    expect(rows[0].reason).toContain("customer cancelled"); // newest first
    expect(rows[0].admin).toBeNull();
    expect(rows[1].admin).toMatchObject({ email: "stock-admin@girah.test" });
    expect(rows[0].variation.product.name).toBeTruthy();
    expect(rows[0].previousStock).toBe(3);
    expect(rows[0].adjustment).toBe(1);
  });

  it("search filters by product OR variation name, case-insensitively", async () => {
    const target = await createTestProduct();
    const other = await createTestProduct();
    for (const [variation, adjustment, name] of [
      [target.variation, 1, "Target"],
      [other.variation, 2, "Other"],
    ] as const) {
      await db.stockAdjustment.create({
        data: {
          variationId: variation.id,
          previousStock: 0,
          adjustment,
          newStock: adjustment,
          reason: `Set ${name}`,
        },
      });
    }

    const byProduct = await getStockAdjustmentFeed({ search: target.product.name.toUpperCase() });
    expect(byProduct).toHaveLength(1);
    expect(byProduct[0].variationId).toBe(target.variation.id);

    const byVariation = await getStockAdjustmentFeed({ search: "test variation" });
    expect(byVariation).toHaveLength(2);

    expect(await getStockAdjustmentFeed({ search: "nothing-matches" })).toHaveLength(0);
  });

  it("is empty before any adjustment exists", async () => {
    expect(await getStockAdjustmentFeed()).toEqual([]);
  });

  it("caps the feed at 200 rows so the page stays one bounded read", async () => {
    const { variation } = await createTestProduct();
    await db.stockAdjustment.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        variationId: variation.id,
        previousStock: i + 1,
        adjustment: -1,
        newStock: i,
        reason: `Bulk row ${i}`,
      })),
    });
    const rows = await getStockAdjustmentFeed();
    expect(rows).toHaveLength(200);
    expect(rows.every((row) => row.reason.startsWith("Bulk row"))).toBe(true); // capped, not an error/short list
  });
});
