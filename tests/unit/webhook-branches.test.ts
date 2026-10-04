import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({ sendEmailSafe: vi.fn() }));

// @sfpy/node-core pulls axios (removed from our deps); the refund helper is
// mocked because no branch below reaches an actual refund call.
vi.mock("@/modules/payments/safepay", () => ({ refundSafepayPayment: vi.fn() }));

import { db } from "@/lib/db";
import { sendEmailSafe } from "@/lib/email";
import { processSafepayWebhook } from "@/modules/payments/webhook-core";

// Phase B: webhook edge branches without a database. The db client is
// mocked; signatures are real (legacy HMAC-SHA512 over the raw body), so
// the 401/400 gates are exercised for truth, not just wiring.
const SECRET = "dGVzdC13ZWJob29rLXNlY3JldC0wMTIzNDU2Nzg=";

function sign(body: string): string {
  return crypto.createHmac("sha512", SECRET).update(body).digest("hex");
}

function mockOrder(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "GIR-TEST-000001",
    paymentMethod: "SAFEPAY",
    paymentStatus: "PENDING",
    orderStatus: "CONFIRMED",
    total: 180000,
    customerEmail: "buyer@example.com",
    customerName: "Test Buyer",
    createdAt: new Date(),
    safepayTracker: "tracker-1",
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orders = () => (db.order as any);

beforeEach(() => {
  vi.stubEnv("SAFEPAY_WEBHOOK_SECRET", SECRET);
  vi.mocked(orders().findUnique).mockReset().mockResolvedValue(null);
  vi.mocked(orders().findFirst).mockReset().mockResolvedValue(null);
  vi.mocked(orders().updateMany).mockReset().mockResolvedValue({ count: 1 });
  vi.mocked(sendEmailSafe).mockReset();
});

describe("processSafepayWebhook edge branches", () => {
  it("rejects a bad signature with 401 before parsing anything", async () => {
    const result = await processSafepayWebhook("{invalid", "deadbeef", null);
    expect(result.status).toBe(401);
    expect(orders().findUnique).not.toHaveBeenCalled();
  });

  it("rejects a signed-but-malformed body with 400", async () => {
    const body = "{not json";
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(400);
  });

  it("acknowledges (200, no-op) when no order matches", async () => {
    const body = JSON.stringify({ type: "payment.succeeded", data: { tracker: "nope" } });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(orders().updateMany).not.toHaveBeenCalled();
  });

  it("ignores signed events naming a COD order", async () => {
    vi.mocked(orders().findUnique).mockResolvedValue(mockOrder({ paymentMethod: "COD" }));
    const body = JSON.stringify({
      type: "payment.succeeded",
      data: { metadata: { order_id: "order-1" }, amount: 180000, currency: "PKR" },
    });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(200);
    expect(orders().updateMany).not.toHaveBeenCalled();
    expect(sendEmailSafe).not.toHaveBeenCalled();
  });

  it("acknowledges unknown event types without touching state", async () => {
    vi.mocked(orders().findUnique).mockResolvedValue(mockOrder());
    const body = JSON.stringify({ type: "payment.whatever", data: { metadata: { order_id: "order-1" } } });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(200);
    expect(orders().updateMany).not.toHaveBeenCalled();
  });

  it("resolves the order via tracker fallback when metadata is empty", async () => {
    vi.mocked(orders().findFirst).mockResolvedValue(mockOrder());
    const body = JSON.stringify({
      type: "payment.failed",
      data: { tracker: "tracker-1", amount: 180000, currency: "PKR" },
    });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(200);
    expect(orders().updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
  });

  it("processes a REFUNDED event only from PAID, emailing once", async () => {
    vi.mocked(orders().findUnique).mockResolvedValue(
      mockOrder({ paymentStatus: "PAID", orderStatus: "CONFIRMED" })
    );
    const body = JSON.stringify({
      type: "payment.refunded",
      data: { metadata: { order_id: "order-1" } },
    });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(200);
    expect(orders().updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", paymentStatus: "PAID" },
      data: { paymentStatus: "REFUNDED" },
    });
    expect(sendEmailSafe).toHaveBeenCalledTimes(1);
  });

  it("refuses a wrong amount without marking PAID", async () => {
    vi.mocked(orders().findUnique).mockResolvedValue(mockOrder());
    const body = JSON.stringify({
      type: "payment.succeeded",
      data: { metadata: { order_id: "order-1" }, amount: 1, currency: "PKR" },
    });
    const result = await processSafepayWebhook(body, sign(body), null);
    expect(result.status).toBe(200);
    expect(orders().updateMany).not.toHaveBeenCalled();
    expect(sendEmailSafe).not.toHaveBeenCalled();
  });
});
