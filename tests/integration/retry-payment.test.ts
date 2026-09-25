import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { retrySafepayPayment } from "@/modules/orders/actions";
import { resetDb } from "../setup/helpers";

// Phase 3: "Pay now" retry — creates a fresh Safepay session for an unpaid
// order and persists its tracker (the CAS in createSafepayCheckoutUrl must
// never overwrite the tracker of a PAID order).

const sdk = vi.hoisted(() => {
  let counter = 0;
  const state = {
    checkoutConfigs: [] as Array<Record<string, string>>,
    refundMock: vi.fn(),
    setupMock: vi.fn(async () => {
      counter += 1;
      return { data: { tracker: { token: `track_test_${counter}` } } };
    }),
    reset() {
      counter = 0;
      state.checkoutConfigs.length = 0;
      state.refundMock.mockReset();
      state.setupMock.mockReset().mockImplementation(async () => {
        counter += 1;
        return { data: { tracker: { token: `track_test_${counter}` } } };
      });
    },
  };
  return state;
});

vi.mock("@sfpy/node-core", () => ({
  default: class FakeSafepay {
    payments = { session: { setup: sdk.setupMock } };
    order = { cancel: { refund: sdk.refundMock } };
    checkout = {
      createCheckoutUrl: (cfg: Record<string, string>) => {
        sdk.checkoutConfigs.push(cfg);
        return `https://sandbox.pay/checkout?tracker=${cfg.tracker}&cancel=${encodeURIComponent(cfg.cancel_url)}`;
      },
    };
  },
}));

vi.mock("axios", () => ({
  default: { post: vi.fn(async () => ({ data: { data: "sec_test_passport" } })) },
}));

process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-R${Date.now()}${orderCounter}`,
      customerName: "Retry Tester",
      customerEmail: "retry@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 7",
      shippingCity: "Islamabad",
      subtotal: 50_000,
      total: 50_000,
      paymentMethod: "SAFEPAY",
      ...overrides,
    },
  });
}

async function refresh(id: string) {
  return db.order.findUniqueOrThrow({ where: { id } });
}

describe("retrySafepayPayment", () => {
  beforeEach(async () => {
    await resetDb();
    sdk.reset();
  });

  it("creates a fresh session for a pending order, persists the tracker, and targets the confirmation page", async () => {
    const order = await seedOrder();

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.checkoutUrl).toContain("track_test_1");
    expect((await refresh(order.id)).safepayTracker).toBe("track_test_1");

    const cfg = sdk.checkoutConfigs[0];
    expect(cfg.tracker).toBe("track_test_1");
    expect(cfg.order_id).toBe(order.id);
    expect(cfg.redirect_url).toBe(`${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}/confirmation`);
    expect(cfg.cancel_url).toBe(
      `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}/confirmation?cancelled=1`
    );
  });

  it("a second retry replaces the tracker while the payment is still not captured", async () => {
    const order = await seedOrder();

    await retrySafepayPayment(order.id);
    const second = await retrySafepayPayment(order.id);

    expect(second.success).toBe(true);
    expect((await refresh(order.id)).safepayTracker).toBe("track_test_2");
  });

  it("refuses to create a session once the order is PAID — tracker stays the refund target", async () => {
    const order = await seedOrder({ paymentStatus: "PAID", safepayTracker: "track_paid_session" });

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already paid/i);

    expect(sdk.setupMock).not.toHaveBeenCalled();
    expect((await refresh(order.id)).safepayTracker).toBe("track_paid_session");
  });

  it("refuses REFUNDED and CANCELLED orders", async () => {
    const refunded = await seedOrder({ paymentStatus: "REFUNDED" });
    const cancelled = await seedOrder({ orderStatus: "CANCELLED" });

    const a = await retrySafepayPayment(refunded.id);
    expect(a.success).toBe(false);
    if (!a.success) expect(a.error).toMatch(/refunded/i);

    const b = await retrySafepayPayment(cancelled.id);
    expect(b.success).toBe(false);
    if (!b.success) expect(b.error).toMatch(/cancelled/i);
    expect(sdk.setupMock).not.toHaveBeenCalled();
  });

  it("refuses non-Safepay orders and unknown ids", async () => {
    const cod = await seedOrder({ paymentMethod: "COD" });

    const a = await retrySafepayPayment(cod.id);
    expect(a.success).toBe(false);
    if (!a.success) expect(a.error).toMatch(/online payment/i);

    const b = await retrySafepayPayment("no-such-order");
    expect(b.success).toBe(false);
    if (!b.success) expect(b.error).toBe("Order not found.");
  });

  it("surfaces a friendly error (and no tracker write) when the Safepay API fails", async () => {
    sdk.setupMock.mockRejectedValueOnce(new Error("safepay down"));
    const order = await seedOrder();

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/couldn't start the payment/i);
    expect((await refresh(order.id)).safepayTracker).toBeNull();
  });
});
