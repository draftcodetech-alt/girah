import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { retrySafepayPayment } from "@/modules/orders/actions";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 M1: minting a fresh payment session re-points safepayTracker —
// only the owning session may do that for an account order; guest orders
// stay cuid-bearer. Unauthorized callers get the SAME response as a missing
// id, so the endpoint can't probe which order ids exist.

const sdk = vi.hoisted(() => {
  let counter = 0;
  return {
    checkoutConfigs: [] as Array<Record<string, string>>,
    setupMock: vi.fn(async () => {
      counter += 1;
      return { data: { tracker: { token: `track_own_${counter}` } } };
    }),
    reset() {
      counter = 0;
      sdk.checkoutConfigs.length = 0;
      sdk.setupMock.mockReset().mockImplementation(async () => {
        counter += 1;
        return { data: { tracker: { token: `track_own_${counter}` } } };
      });
    },
  };
});

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@sfpy/node-core", () => ({
  default: class FakeSafepay {
    payments = { session: { setup: sdk.setupMock } };
    order = { cancel: { refund: vi.fn() } };
    checkout = {
      createCheckoutUrl: (cfg: Record<string, string>) => {
        sdk.checkoutConfigs.push(cfg);
        return `https://sandbox.pay/checkout?tracker=${cfg.tracker}`;
      },
    };
  },
}));

vi.mock("axios", () => ({
  default: { post: vi.fn(async () => ({ data: { data: "sec_test_passport" } })) },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));

process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

let orderCounter = 0;
async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-OWN${Date.now()}${orderCounter}`,
      customerName: "Owner Tester",
      customerEmail: "owner@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 11",
      shippingCity: "Islamabad",
      subtotal: 50_000,
      total: 50_000,
      paymentMethod: "SAFEPAY",
      ...overrides,
    },
  });
}

const MISSING_ERROR = "Order not found.";

describe("retrySafepayPayment ownership", () => {
  beforeEach(async () => {
    await resetDb();
    sdk.reset();
    authMock.mockReset();
  });

  it("allows a guest order (cuid bearer) with no session", async () => {
    authMock.mockResolvedValue(null);
    const order = await seedOrder();

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).safepayTracker).toBe(
      "track_own_1"
    );
  });

  it("allows the OWNING session of an account order", async () => {
    const owner = await createTestUser({ email: "owner-retry@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOrder({ userId: owner.id });

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(true);
  });

  it("refuses a logged-in STRANGER with the generic not-found error", async () => {
    const owner = await createTestUser({ email: "owner2@girah.test" });
    const stranger = await createTestUser({ email: "stranger@girah.test" });
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const order = await seedOrder({ userId: owner.id });

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(MISSING_ERROR);

    expect(sdk.setupMock).not.toHaveBeenCalled();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).safepayTracker).toBeNull();
  });

  it("refuses an account order with NO session", async () => {
    const owner = await createTestUser({ email: "owner3@girah.test" });
    authMock.mockResolvedValue(null);
    const order = await seedOrder({ userId: owner.id });

    const result = await retrySafepayPayment(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(MISSING_ERROR);
    expect(sdk.setupMock).not.toHaveBeenCalled();
  });

  it("is indistinguishable from a missing order id", async () => {
    authMock.mockResolvedValue(null);

    const missing = await retrySafepayPayment("no-such-order");
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error).toBe(MISSING_ERROR);
    const missingError = missing.success ? null : missing.error;

    const owner = await createTestUser({ email: "owner4@girah.test" });
    authMock.mockResolvedValue({ user: { id: "someone-else", role: "CUSTOMER" } });
    const order = await seedOrder({ userId: owner.id });

    const unauthorized = await retrySafepayPayment(order.id);
    expect(unauthorized.success).toBe(false);
    if (!unauthorized.success) expect(unauthorized.error).toBe(missingError);
  });
});
