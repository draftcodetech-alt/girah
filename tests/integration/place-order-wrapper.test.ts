import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { sendEmailSafe } from "@/lib/email";
import { createSafepayCheckoutUrl } from "@/modules/payments";
import { placeOrder } from "@/modules/checkout/actions";
import type { CheckoutInput } from "@/modules/checkout/schema";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 1 integration: the `placeOrder` SERVER ACTION — the wrapper layer
// placeOrderCore deliberately skips: zod gate, the Safepay-configured gate,
// request-context identity (session vs guest cookie) and the opt-in saved
// address. No HTTP: request context is supplied by the same next/headers
// double the login tests use, and every external service is mocked.

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  revalidated: 0,
}));
const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  handlers: {},
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.jar.has(name) ? { name, value: state.jar.get(name) as string } : undefined,
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      state.jar.set(name, value);
    },
    delete: (name: string) => {
      state.jar.delete(name);
    },
  }),
  headers: async () => new Headers({ host: "localhost:3100", "x-forwarded-proto": "http" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {
    state.revalidated += 1;
  }),
}));
vi.mock("@/lib/email", () => ({
  isEmailDevLogMode: vi.fn(() => true),
  sendEmail: vi.fn(async () => {}),
  sendEmailSafe: vi.fn(async () => {}),
}));
// Neutralise the Safepay API surface but KEEP the real isSafepayConfigured —
// the refusal test below depends on it reading the real environment.
vi.mock("@/modules/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/payments")>();
  return {
    ...actual,
    createSafepayCheckoutUrl: vi.fn(),
    refundSafepayPayment: vi.fn(),
  };
});

const GUEST = "girah_guest_id";

const checkout: CheckoutInput = {
  fullName: "Wrapper Tester",
  phone: "03001112223",
  email: "wrapper@girah.test",
  address: "Street 12, Test Block",
  city: "Islamabad",
  postalCode: "44000",
  deliveryNotes: "",
  paymentMethod: "COD",
};

async function seedCartForGuest(guestId: string, quantity = 2) {
  const { variation } = await createTestProduct(); // stock 5
  const cart = await db.cart.create({ data: { guestId } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity } });
  return { cart, variation };
}

async function seedCartForUser(userId: string, quantity = 2) {
  const { variation } = await createTestProduct();
  // One cart per account (userId is @unique) — reuse it across checkouts.
  const cart = await db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity } });
  return { cart, variation };
}

const send = vi.mocked(sendEmailSafe);

beforeEach(async () => {
  await resetDb();
  state.jar.clear();
  state.revalidated = 0;
  authMock.mockReset().mockResolvedValue(null);
  send.mockClear();
  vi.mocked(createSafepayCheckoutUrl).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("placeOrder — unauthenticated guest COD order", () => {
  it("creates the order against the guest cookie identity, empties the cart, mails once", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await seedCartForGuest("guest-wrapper");
    state.jar.set(GUEST, "guest-wrapper");

    const result = await placeOrder(checkout);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.userId).toBeNull(); // never attributed to an account
    expect(order.customerEmail).toBe(checkout.email);
    expect(order.paymentMethod).toBe("COD");
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.total).toBe(200_000); // 100_000 × 2

    // Cart emptied, stock decremented once, order-received mail sent once.
    expect(await db.cartItem.count()).toBe(0);
    expect(
      (await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock
    ).toBe(3);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(checkout.email);
    expect(state.revalidated).toBeGreaterThan(0);
    expect(createSafepayCheckoutUrl).not.toHaveBeenCalled();
  });

  it("refuses with a generic message when the guest cart does not exist", async () => {
    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-with-no-cart");

    const result = await placeOrder(checkout);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Your cart is empty.");
    expect(await db.order.count()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("placeOrder — zod gate", () => {
  it("returns fieldErrors and writes no order row", async () => {
    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-zod");
    await seedCartForGuest("guest-zod");

    const result = await placeOrder({ ...checkout, email: "not-an-email" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Please check the highlighted fields.");
      expect(result.fieldErrors?.email).toBeTruthy();
    }
    expect(await db.order.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(1); // cart untouched
    expect(send).not.toHaveBeenCalled();
  });

  it("reports every offending field at once", async () => {
    const result = await placeOrder({
      ...checkout,
      fullName: "",
      phone: "",
      paymentMethod: "CARRIER_PIGEON" as CheckoutInput["paymentMethod"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(
        expect.arrayContaining(["fullName", "phone", "paymentMethod"])
      );
    }
    expect(await db.order.count()).toBe(0);
  });
});

describe("placeOrder — Safepay not configured", () => {
  it("refuses SAFEPAY before creating any order, and says what to do instead", async () => {
    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-safepay");
    await seedCartForGuest("guest-safepay");

    // .env ships real keys for the dev store — blank them for this call only.
    vi.stubEnv("SAFEPAY_API_KEY", "");
    vi.stubEnv("SAFEPAY_API_SECRET", "");

    const result = await placeOrder({ ...checkout, paymentMethod: "SAFEPAY" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Online payment is not available right now. Please choose Cash on Delivery."
      );
    }
    expect(await db.order.count()).toBe(0); // refused BEFORE the order row
    expect(await db.cartItem.count()).toBe(1); // cart still intact for a COD retry
    expect(createSafepayCheckoutUrl).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
    // Restored: with keys present the same payload is no longer refused here
    // (it proceeds to the normal order flow instead).
    expect(process.env.SAFEPAY_API_KEY).toBeTruthy();
  });

  it("never applies the Safepay refusal to a COD order while keys are missing", async () => {
    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-cod-while-unconfigured");
    await seedCartForGuest("guest-cod-while-unconfigured");

    vi.stubEnv("SAFEPAY_API_KEY", "");
    vi.stubEnv("SAFEPAY_API_SECRET", "");

    const result = await placeOrder(checkout);

    expect(result.success).toBe(true);
    expect(await db.order.count()).toBe(1);
  });
});

describe("placeOrder — saveAddress", () => {
  it("creates exactly one SavedShipping row for a signed-in customer", async () => {
    const user = await createTestUser({ email: "saved-addr@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    await seedCartForUser(user.id);

    const result = await placeOrder({ ...checkout, saveAddress: true });

    expect(result.success).toBe(true);
    const rows = await db.savedShipping.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fullName: checkout.fullName,
      phone: checkout.phone,
      address: checkout.address,
      city: checkout.city,
      postalCode: checkout.postalCode,
    });

    // Second checkout with a moved house → still ONE row, updated in place.
    await seedCartForUser(user.id);
    const moved = await placeOrder({
      ...checkout,
      address: "Street 99, New Town",
      saveAddress: true,
    });
    expect(moved.success).toBe(true);
    const after = await db.savedShipping.findMany({ where: { userId: user.id } });
    expect(after).toHaveLength(1);
    expect(after[0].address).toBe("Street 99, New Town");
  });

  it("writes no SavedShipping row when the checkbox is off or the caller is a guest", async () => {
    const user = await createTestUser({ email: "no-save@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    await seedCartForUser(user.id);
    expect((await placeOrder({ ...checkout, saveAddress: false })).success).toBe(true);
    expect(await db.savedShipping.count()).toBe(0);

    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-no-save");
    await seedCartForGuest("guest-no-save");
    expect((await placeOrder({ ...checkout, saveAddress: true })).success).toBe(true);
    expect(await db.savedShipping.count()).toBe(0); // guests are never persisted
  });
});

describe("placeOrder — duplicate-checkout guard", () => {
  it("a second identical submit fails and produces no second order", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await seedCartForGuest("guest-double");
    state.jar.set(GUEST, "guest-double");

    const first = await placeOrder(checkout);
    expect(first.success).toBe(true);

    const second = await placeOrder(checkout);

    expect(second.success).toBe(false);
    if (!second.success) {
      // The emptied cart trips the guard before any stock or order work.
      expect(second.error).toMatch(/cart is empty|already completed/i);
    }
    expect(await db.order.count()).toBe(1);
    // Stock decremented exactly once — the refused submit never touched it.
    expect(
      (await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock
    ).toBe(3);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("two racing submits of the same cart produce exactly one order", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await seedCartForGuest("guest-race");
    state.jar.set(GUEST, "guest-race");

    const results = await Promise.all([placeOrder(checkout), placeOrder(checkout)]);

    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(1);
    const failure = results.find((r) => !r.success);
    if (failure && !failure.success) {
      expect(failure.error).toMatch(/cart is empty|already completed/i);
    }
    expect(await db.order.count()).toBe(1);
    expect(
      (await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).stock
    ).toBe(3);
  });
});
