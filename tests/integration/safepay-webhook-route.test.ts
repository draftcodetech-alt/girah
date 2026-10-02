import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { POST } from "@/app/api/webhooks/safepay/route";
import { resetDb } from "../setup/helpers";

// Coverage gap R7: the HTTP route wrapper itself (header extraction,
// NextResponse serialization) was never executed — webhook.test.ts talks to
// processSafepayWebhook directly, so a typo'd header name in route.ts would
// have shipped green. Both documented signature schemes are driven through
// the route here.

vi.mock("@/modules/payments/safepay", () => ({
  refundSafepayPayment: vi.fn(),
  createSafepayCheckoutUrl: vi.fn(),
  SafepayRefundError: class SafepayRefundError extends Error {},
  isSafepayConfigured: vi.fn(() => true),
}));

if (!process.env.SAFEPAY_WEBHOOK_SECRET) {
  process.env.SAFEPAY_WEBHOOK_SECRET = "test-webhook-secret";
}
const SECRET = process.env.SAFEPAY_WEBHOOK_SECRET;

function legacySignature(rawBody: string, secret: string = SECRET): string {
  return crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
}

function timestampedSignature(rawBody: string, timestamp: string, secret: string = SECRET): string {
  const key = Buffer.from(secret, "base64");
  return (
    "sha256=" + crypto.createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex")
  );
}

function webhookRequest(
  rawBody: string,
  headers: Record<string, string>
): Promise<Response> {
  const request = new NextRequest("http://localhost/api/webhooks/safepay", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });
  return POST(request);
}

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-RT${Date.now()}${orderCounter}`,
      customerName: "Route Tester",
      customerEmail: "route-test@girah.test",
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

function succeededPayload(orderId: string) {
  return {
    type: "payment.succeeded",
    data: {
      tracker: "track_route_primary",
      amount: 100_000,
      currency: "PKR",
      metadata: { order_id: orderId },
    },
  };
}

async function refresh(id: string) {
  return db.order.findUniqueOrThrow({ where: { id } });
}

describe("POST /api/webhooks/safepay", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.SAFEPAY_WEBHOOK_SECRET = SECRET;
  });

  it("returns 401 for a delivery with no signature header", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));

    const res = await webhookRequest(rawBody, {});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid signature" });
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("returns 401 for a wrong signature and leaves the order untouched", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));

    const res = await webhookRequest(rawBody, {
      "x-sfpy-signature": legacySignature(rawBody, "wrong-secret"),
    });
    expect(res.status).toBe(401);
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("returns 400 for malformed JSON that carries a valid signature", async () => {
    const rawBody = "{not json";
    const res = await webhookRequest(rawBody, { "x-sfpy-signature": legacySignature(rawBody) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Malformed JSON" });
  });

  it("marks the order PAID for a legacy HMAC-SHA512 delivery", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));

    const res = await webhookRequest(rawBody, { "x-sfpy-signature": legacySignature(rawBody) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const fresh = await refresh(order.id);
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.safepayTracker).toBe("track_route_primary");
  });

  it("marks the order PAID for a sha256= + timestamp delivery (both headers must be forwarded)", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));
    const timestamp = new Date().toISOString();

    const res = await webhookRequest(rawBody, {
      "x-sfpy-signature": timestampedSignature(rawBody, timestamp),
      "x-sfpy-timestamp": timestamp,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect((await refresh(order.id)).paymentStatus).toBe("PAID");
  });

  it("rejects the timestamped scheme when the timestamp header is dropped", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));
    const timestamp = new Date().toISOString();

    const res = await webhookRequest(rawBody, {
      "x-sfpy-signature": timestampedSignature(rawBody, timestamp),
    });
    expect(res.status).toBe(401);
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
  });

  it("fails closed when SAFEPAY_WEBHOOK_SECRET is unset", async () => {
    const order = await seedOrder();
    const rawBody = JSON.stringify(succeededPayload(order.id));
    const signature = legacySignature(rawBody);
    delete process.env.SAFEPAY_WEBHOOK_SECRET;

    const res = await webhookRequest(rawBody, { "x-sfpy-signature": signature });
    expect(res.status).toBe(401);
    expect((await refresh(order.id)).paymentStatus).toBe("PENDING");
    process.env.SAFEPAY_WEBHOOK_SECRET = SECRET;
  });
});
