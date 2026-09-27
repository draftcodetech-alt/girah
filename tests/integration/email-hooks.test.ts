import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmailSafe } from "@/lib/email";
import { processSafepayWebhook } from "@/modules/payments/webhook-core";
import { refundSafepayPayment } from "@/modules/payments/safepay";
import { updateOrderStatusCore } from "@/modules/orders/status-ops";
import { register, requestPasswordReset } from "@/modules/accounts/actions";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 14: the four post-commit hooks. The transport is mocked, so every
// assertion is on WHO gets mail and WHEN — never on rendering (unit suite).

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  handlers: {},
}));
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

function lastSubject(): string {
  const calls = send.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const input = calls[calls.length - 1][0];
  return input.subject;
}

function signed(rawBody: string): string {
  return crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
}

function deliver(payload: unknown) {
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
  return processSafepayWebhook(rawBody, signed(rawBody));
}

function succeededPayload(orderId: string) {
  return {
    type: "payment.succeeded",
    data: {
      tracker: "track_email_evt",
      amount: 100_000,
      currency: "PKR",
      metadata: { order_id: orderId },
    },
  };
}

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-EML${Date.now()}${orderCounter}`,
      customerName: "Mail Tester",
      customerEmail: "mail-target@girah.test",
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

beforeEach(async () => {
  await resetDb();
  send.mockClear();
  vi.mocked(refundSafepayPayment).mockReset();
  vi.mocked(refundSafepayPayment).mockResolvedValue(undefined as never);
});

describe("webhook payment-result emails", () => {
  it("confirms the payer exactly once per transition", async () => {
    const order = await seedOrder();
    const res = await deliver(succeededPayload(order.id));
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSubject()).toBe(`Payment confirmed — #${order.orderNumber}`);
    expect(send.mock.calls[0][0].to).toBe("mail-target@girah.test");

    // Duplicate delivery: order already PAID, CAS loses — no second mail.
    await deliver(succeededPayload(order.id));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports a failed payment once and never on a retried delivery", async () => {
    const order = await seedOrder();
    const failed = {
      type: "payment.failed",
      data: { tracker: "t", amount: 100_000, currency: "PKR", metadata: { order_id: order.id } },
    };
    await deliver(failed);
    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSubject()).toBe(`Payment failed — #${order.orderNumber}`);

    await deliver(failed);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("announces a webhook-driven refund", async () => {
    const order = await seedOrder({ paymentStatus: "PAID" });
    const refund = {
      type: "payment.refunded",
      data: { tracker: "t", amount: 100_000, currency: "PKR", metadata: { order_id: order.id } },
    };
    await deliver(refund);
    expect(lastSubject()).toBe(`Payment refunded — #${order.orderNumber}`);
    await deliver(refund);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stays silent when no order matches", async () => {
    await deliver(succeededPayload("no-such-order"));
    expect(send).not.toHaveBeenCalled();
  });
});

describe("order status emails", () => {
  const adminId = null;

  it("stays quiet through CONFIRMED and PROCESSING", async () => {
    const order = await seedOrder({ paymentMethod: "COD" });
    await updateOrderStatusCore(order.id, { orderStatus: "CONFIRMED" }, adminId);
    await updateOrderStatusCore(order.id, { orderStatus: "PROCESSING" }, adminId);
    expect(send).not.toHaveBeenCalled();
  });

  it("emails SHIPPED and DELIVERED through the state machine", async () => {
    const order = await seedOrder({ paymentMethod: "COD" });
    await updateOrderStatusCore(order.id, { orderStatus: "CONFIRMED" }, adminId);
    await updateOrderStatusCore(order.id, { orderStatus: "PROCESSING" }, adminId);
    await updateOrderStatusCore(order.id, { orderStatus: "SHIPPED" }, adminId);
    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSubject()).toBe(`Your order has shipped — #${order.orderNumber}`);

    await updateOrderStatusCore(order.id, { orderStatus: "DELIVERED" }, adminId);
    expect(send).toHaveBeenCalledTimes(2);
    expect(lastSubject()).toBe(`Order delivered — #${order.orderNumber}`);
  });

  it("cancelling an unpaid order promises no refund that was not issued", async () => {
    const order = await seedOrder({ paymentMethod: "COD" });
    await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, adminId);
    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSubject()).toBe(`Order cancelled — #${order.orderNumber}`);
    expect(send.mock.calls[0][0].html).not.toContain("payment has been refunded");
    expect(send.mock.calls[0][0].html).toContain("any due refund is on its way");
  });

  it("cancelling a paid Safepay order says refunded (refund issued first)", async () => {
    const order = await seedOrder({ paymentStatus: "PAID", safepayTracker: "track_email_cancel" });
    await updateOrderStatusCore(order.id, { orderStatus: "CANCELLED" }, adminId);
    expect(vi.mocked(refundSafepayPayment)).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].html).toContain("payment has been refunded");
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.paymentStatus).toBe("REFUNDED");
    expect(row.orderStatus).toBe("CANCELLED");
  });

  it("a duplicate same-status click never mails again", async () => {
    const order = await seedOrder({ paymentMethod: "COD" });
    await updateOrderStatusCore(order.id, { orderStatus: "CONFIRMED" }, adminId);
    await updateOrderStatusCore(order.id, { orderStatus: "PROCESSING" }, adminId);
    await updateOrderStatusCore(order.id, { orderStatus: "SHIPPED" }, adminId);
    expect(send).toHaveBeenCalledTimes(1);
    const again = await updateOrderStatusCore(order.id, { orderStatus: "SHIPPED" }, adminId);
    expect(again.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("account emails", () => {
  it("welcomes a new registration", async () => {
    const email = `welcome-${Date.now()}@girah.test`;
    const result = await register({
      name: "Welcome Tester",
      email,
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(email);
    expect(send.mock.calls[0][0].subject).toBe("Welcome to Girah");
    expect(send.mock.calls[0][0].html).toContain("Welcome Tester");
  });

  it("sends a reset link for a known address and nothing for an unknown one", async () => {
    const user = await createTestUser({ email: `target-${Date.now()}@girah.test` });
    await requestPasswordReset({ email: user.email });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Reset your Girah password");
    expect(send.mock.calls[0][0].html).toContain("/reset-password?token=");

    await requestPasswordReset({ email: `ghost-${Date.now()}@girah.test` });
    expect(send).toHaveBeenCalledTimes(1); // unknown address sends no mail
  });

  it("a second request replaces the previous link in the mailbox too", async () => {
    const user = await createTestUser({ email: `twice-${Date.now()}@girah.test` });
    await requestPasswordReset({ email: user.email });
    await requestPasswordReset({ email: user.email });
    expect(send).toHaveBeenCalledTimes(2);
    const html = send.mock.calls[1][0].html;
    const firstToken = send.mock.calls[0][0].html.match(/token=([0-9a-f]+)/)?.[1];
    const secondToken = html.match(/token=([0-9a-f]+)/)?.[1];
    expect(firstToken).toBeTruthy();
    expect(secondToken).toBeTruthy();
    expect(secondToken).not.toBe(firstToken);
    // Only the newest hash is live in the database.
    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });
});
