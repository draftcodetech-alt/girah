import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmailSafe } from "@/lib/email";
import { processSafepayWebhook } from "@/modules/payments/webhook-core";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 1 integration: webhook EDGE cases against the real DB — the paths
// where a delivery must be acknowledged but produce no side effects, and the
// one that matters most in production: five identical refund deliveries fired
// in parallel must move the order exactly once and email exactly once.

vi.mock("@/lib/email", () => ({
  isEmailDevLogMode: vi.fn(() => true),
  sendEmail: vi.fn(async () => {}),
  sendEmailSafe: vi.fn(async () => {}),
}));
vi.mock("@/modules/payments/safepay", () => ({
  refundSafepayPayment: vi.fn(),
  createSafepayCheckoutUrl: vi.fn(),
  SafepayRefundError: class SafepayRefundError extends Error {},
}));

if (!process.env.SAFEPAY_WEBHOOK_SECRET) {
  process.env.SAFEPAY_WEBHOOK_SECRET = "test-webhook-secret";
}
const SECRET = process.env.SAFEPAY_WEBHOOK_SECRET;
const send = vi.mocked(sendEmailSafe);

function sign(rawBody: string): string {
  return crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
}

function deliver(payload: unknown) {
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
  return processSafepayWebhook(rawBody, sign(rawBody));
}

let seq = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  seq += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-EDGE${Date.now()}${seq}`,
      customerName: "Edge Case",
      customerEmail: `edge-${seq}@girah.test`,
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

async function refresh(id: string) {
  return db.order.findUniqueOrThrow({ where: { id } });
}

beforeEach(async () => {
  await resetDb();
  send.mockClear();
});

describe("malformed delivery bodies", () => {
  it("answers 400 for a signed body that is not JSON, touching nothing", async () => {
    const order = await seedOrder({ paymentStatus: "PAID" });
    const rawBody = "{not-json";

    const result = await processSafepayWebhook(rawBody, sign(rawBody));

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "Malformed JSON" });
    expect((await refresh(order.id)).paymentStatus).toBe("PAID");
    expect(send).not.toHaveBeenCalled();
  });

  it("answers 400 for valid JSON that is a bare scalar (no event envelope)", async () => {
    const rawBody = JSON.stringify("just a string");

    const result = await processSafepayWebhook(rawBody, sign(rawBody));

    // A scalar parses, has no type/data → acknowledged as an unhandled event,
    // never as a failure. Documented as the benign branch.
    expect(result.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("unknown tracker", () => {
  it("acknowledges with 200 and performs no side effect for an unmatched tracker", async () => {
    const order = await seedOrder({ paymentStatus: "PAID" });

    const result = await deliver({
      type: "payment.refunded",
      data: { tracker: "track_does_not_exist", metadata: {} },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    expect((await refresh(order.id)).paymentStatus).toBe("PAID"); // untouched
    expect(send).not.toHaveBeenCalled();
    expect(await db.order.count()).toBe(1);
  });

  it("acknowledges a refund event naming an order id that never existed", async () => {
    const result = await deliver({
      type: "payment.refunded",
      data: { tracker: "track_ghost", metadata: { order_id: "order_that_is_gone" } },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("payment.refunded on a PAID order", () => {
  it("moves PAID → REFUNDED and emails the customer exactly once", async () => {
    const { variation } = await createTestProduct();
    const order = await seedOrder({ paymentStatus: "PAID", safepayTracker: "track_refund_edge" });
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
      data: { tracker: "track_refund_edge", metadata: { order_id: order.id } },
    });

    expect(result.status).toBe(200);
    expect((await refresh(order.id)).paymentStatus).toBe("REFUNDED");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(order.customerEmail);

    // Refund events never credit stock — only the cancel flow does.
    expect(await db.stockAdjustment.count()).toBe(0);
    expect((await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock).toBe(5);
  });

  it("is a no-op (and no email) when the order is not PAID yet", async () => {
    const order = await seedOrder({ paymentStatus: "PENDING" });

    await deliver({
      type: "payment.refunded",
      data: { tracker: "track_early", metadata: { order_id: order.id } },
    });

    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("parallel duplicate delivery", () => {
  it("five identical refund events at once → one transition, one email", async () => {
    const order = await seedOrder({ paymentStatus: "PAID", safepayTracker: "track_dupes" });
    const body = JSON.stringify({
      type: "payment.refunded",
      data: { tracker: "track_dupes", metadata: { order_id: order.id } },
    });

    const results = await Promise.all(Array.from({ length: 5 }, () => deliver(body)));

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await refresh(order.id)).paymentStatus).toBe("REFUNDED");
    expect(send).toHaveBeenCalledTimes(1);
    expect(await db.order.count()).toBe(1);
  });

  it("five identical success events at once → one PAID transition, one email", async () => {
    const order = await seedOrder({ paymentStatus: "PENDING", safepayTracker: "track_pay_dupes" });
    const body = JSON.stringify({
      type: "payment.succeeded",
      data: {
        tracker: "track_pay_dupes",
        amount: 100_000,
        currency: "PKR",
        metadata: { order_id: order.id },
      },
    });

    const results = await Promise.all(Array.from({ length: 5 }, () => deliver(body)));

    expect(results.every((r) => r.status === 200)).toBe(true);
    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.safepayTracker).toBe("track_pay_dupes"); // stored once, not clobbered
    expect(send).toHaveBeenCalledTimes(1);
  });
});
