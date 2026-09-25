import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processSafepayWebhook } from "@/modules/payments/webhook-core";
import { refundSafepayPayment } from "@/modules/payments/safepay";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 3: webhook pipeline — signature enforcement, event taxonomy,
// amount/currency guards, CAS transitions, tracker-based resolution.

vi.mock("@/modules/payments/safepay", () => ({
  refundSafepayPayment: vi.fn(),
  createSafepayCheckoutUrl: vi.fn(),
  SafepayRefundError: class SafepayRefundError extends Error {},
}));

if (!process.env.SAFEPAY_WEBHOOK_SECRET) {
  process.env.SAFEPAY_WEBHOOK_SECRET = "test-webhook-secret";
}
const SECRET = process.env.SAFEPAY_WEBHOOK_SECRET;

function sign(rawBody: string, secret: string = SECRET): string {
  return crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
}

function deliver(payload: unknown) {
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
  return processSafepayWebhook(rawBody, sign(rawBody));
}

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-W${Date.now()}${orderCounter}`,
      customerName: "Webhook Tester",
      customerEmail: "webhook@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 1",
      shippingCity: "Islamabad",
      subtotal: 100_000,
      total: 100_000,
      paymentMethod: "SAFEPAY",
      ...overrides,
    },
  });
}

function succeededPayload(orderId: string, extra: Record<string, unknown> = {}) {
  return {
    type: "payment.succeeded",
    data: {
      tracker: "track_evt_primary",
      amount: 100_000,
      currency: "PKR",
      metadata: { order_id: orderId },
      ...extra,
    },
  };
}

async function refresh(id: string) {
  return db.order.findUniqueOrThrow({ where: { id } });
}

describe("processSafepayWebhook", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(refundSafepayPayment).mockReset().mockResolvedValue(undefined);
  });

  it("rejects an invalid signature with 401 and leaves the order untouched", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));

    const result = await processSafepayWebhook(rawBody, sign(rawBody, "wrong-secret"));
    expect(result.status).toBe(401);
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("marks the order PAID on a verified payment.succeeded and stores the tracker", async () => {
    const order = await seedOrder();

    const result = await deliver(succeededPayload(order.id));
    expect(result.status).toBe(200);

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.safepayTracker).toBe("track_evt_primary");
    expect(refundSafepayPayment).not.toHaveBeenCalled();
  });

  it("is idempotent: a duplicated delivery is a no-op and never overwrites a post-PAID tracker", async () => {
    const order = await seedOrder();

    await deliver(succeededPayload(order.id));
    const dup = await deliver(succeededPayload(order.id, { tracker: "track_newer_session" }));
    expect(dup.status).toBe(200);

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.safepayTracker).toBe("track_evt_primary");
  });

  it("keeps PAID through the observed failed-then-succeeded sequence", async () => {
    const order = await seedOrder();

    await deliver({ type: "payment.failed", data: { metadata: { order_id: order.id } } });
    expect((await refresh(order.id)).paymentStatus).toBe("FAILED");

    await deliver(succeededPayload(order.id));
    expect((await refresh(order.id)).paymentStatus).toBe("PAID");
  });

  it("never downgrades PAID when a late payment.failed arrives after success", async () => {
    const order = await seedOrder();

    await deliver(succeededPayload(order.id));
    await deliver({ type: "payment.failed", data: { metadata: { order_id: order.id } } });

    expect((await refresh(order.id)).paymentStatus).toBe("PAID");
  });

  it("resolves a payment.failed with empty metadata via the stored tracker", async () => {
    const order = await seedOrder({ safepayTracker: "track_stored_abc" });

    const result = await deliver({
      type: "payment.failed",
      data: { tracker: "track_stored_abc", metadata: {} },
    });
    expect(result.status).toBe(200);
    expect((await refresh(order.id)).paymentStatus).toBe("FAILED");
  });

  it("refuses to grant PAID when the event amount does not match the order", async () => {
    const order = await seedOrder();

    await deliver(succeededPayload(order.id, { amount: 999 }));

    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("refuses to grant PAID when the event currency is not PKR", async () => {
    const order = await seedOrder();

    await deliver(succeededPayload(order.id, { currency: "USD" }));

    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("ignores events that name a non-Safepay (COD) order", async () => {
    const order = await seedOrder({ paymentMethod: "COD" });

    const result = await deliver(succeededPayload(order.id));
    expect(result.status).toBe(200);

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PENDING");
    expect(fresh.safepayTracker).toBeNull();
  });

  it("acknowledges unknown event types without touching the order", async () => {
    const order = await seedOrder();

    const result = await deliver({
      type: "charge.some_future_event",
      data: { metadata: { order_id: order.id } },
    });
    expect(result.status).toBe(200);
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("returns 400 for malformed JSON even with a valid signature", async () => {
    const rawBody = "{not json";
    const result = await processSafepayWebhook(rawBody, sign(rawBody));
    expect(result.status).toBe(400);
  });

  it("acknowledges events that match no order instead of erroring", async () => {
    const result = await deliver(succeededPayload("order_does_not_exist"));
    expect(result.status).toBe(200);
  });

  it("applies refund events PAID -> REFUNDED without restocking", async () => {
    const { variation } = await createTestProduct();
    const order = await seedOrder({ paymentStatus: "PAID" });
    await db.orderItem.create({
      data: {
        orderId: order.id,
        variationId: variation.id,
        productName: "Product",
        variationName: "Variation",
        unitPrice: 100_000,
        quantity: 2,
        subtotal: 200_000,
      },
    });

    const result = await deliver({
      type: "payment.refunded",
      data: { tracker: "track_evt_primary", metadata: { order_id: order.id } },
    });
    expect(result.status).toBe(200);

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("REFUNDED");
    // Refund events never credit stock — only the cancel flow does.
    expect(await db.stockAdjustment.count()).toBe(0);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
  });

  it("auto-refunds a late payment that lands on an already-cancelled order", async () => {
    const order = await seedOrder({ orderStatus: "CANCELLED", safepayTracker: "track_refund_me" });

    await deliver(succeededPayload(order.id, { tracker: "track_refund_me" }));

    expect(refundSafepayPayment).toHaveBeenCalledWith("track_refund_me", 100_000);
    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("REFUNDED");
    expect(fresh.orderStatus).toBe("CANCELLED");
  });

  it("records PAID (with a CRITICAL log) when the auto-refund of a late payment fails", async () => {
    vi.mocked(refundSafepayPayment).mockRejectedValueOnce(new Error("gateway down"));
    const order = await seedOrder({ orderStatus: "CANCELLED", safepayTracker: "track_refund_me" });

    await deliver(succeededPayload(order.id, { tracker: "track_refund_me" }));

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.orderStatus).toBe("CANCELLED");
  });

  it("records PAID (with a CRITICAL log) when a late payment arrives with no tracker anywhere", async () => {
    const order = await seedOrder({ orderStatus: "CANCELLED" });

    await deliver({
      type: "payment.succeeded",
      data: { amount: 100_000, currency: "PKR", metadata: { order_id: order.id } },
    });

    expect(refundSafepayPayment).not.toHaveBeenCalled();
    expect((await refresh(order.id)).paymentStatus).toBe("PAID");
  });
});
