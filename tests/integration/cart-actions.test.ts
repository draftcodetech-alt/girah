import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { addToCart, removeCartItem, updateCartItemQuantity } from "@/modules/cart/actions";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 1 integration: the cart action WRAPPERS (not the cores) — the layer
// that owns request context: session resolution, the guest cookie identity
// and the stock re-check that runs on every add, regardless of what the
// client claims it sent.

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  revalidated: [] as string[],
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
  revalidatePath: vi.fn((...args: unknown[]) => {
    state.revalidated.push(args.join(" "));
  }),
}));

const GUEST = "girah_guest_id";

async function lineFor(cartId: string, variationId: string) {
  return db.cartItem.findFirst({ where: { cartId, variationId } });
}

beforeEach(async () => {
  await resetDb();
  state.jar.clear();
  state.revalidated.length = 0;
  authMock.mockReset().mockResolvedValue(null);
});

describe("addToCart — server-side stock rules", () => {
  it("caps the quantity at the live stock, never above", async () => {
    const { variation } = await createTestProduct(); // stock 5
    state.jar.set(GUEST, "guest-cap");

    expect(await addToCart(variation.id, 3)).toEqual({ success: true });
    let line = await db.cartItem.findFirst({
      where: { cart: { guestId: "guest-cap" }, variationId: variation.id },
    });
    expect(line?.quantity).toBe(3);

    // 3 + 4 = 7 requested against stock 5 → clamped to 5, never 7.
    expect(await addToCart(variation.id, 4)).toEqual({ success: true });
    line = await db.cartItem.findFirst({
      where: { cart: { guestId: "guest-cap" }, variationId: variation.id },
    });
    expect(line?.quantity).toBe(5);
    expect(state.revalidated.length).toBe(2);
  });

  it("refuses a disabled variation without creating a line", async () => {
    const { variation } = await createTestProduct();
    await db.productVariation.update({ where: { id: variation.id }, data: { isEnabled: false } });
    state.jar.set(GUEST, "guest-disabled");

    const result = await addToCart(variation.id, 1);

    expect(result).toEqual({ success: false, error: "This item is no longer available." });
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.cart.count()).toBe(0);
  });

  it("refuses a variation with zero stock and one that does not exist", async () => {
    const { variation } = await createTestProduct();
    await db.productVariation.update({ where: { id: variation.id }, data: { stock: 0 } });
    state.jar.set(GUEST, "guest-out");

    expect(await addToCart(variation.id, 1)).toEqual({
      success: false,
      error: "This item is no longer available.",
    });
    expect(await addToCart("variation-that-never-existed", 1)).toEqual({
      success: false,
      error: "This item is no longer available.",
    });
    expect(await db.cartItem.count()).toBe(0);
  });

  it("rejects quantities the client should never have sent", async () => {
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-bad-qty");

    for (const bad of [0, -3, 1.5, Number.NaN, 1_000]) {
      expect(await addToCart(variation.id, bad)).toEqual({ success: false, error: "Invalid quantity." });
    }
    expect(await db.cart.count()).toBe(0);
  });
});

describe("guest cart identity", () => {
  it("resolves a signed-out caller to a guestId cart when the cookie exists", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-known");

    expect(await addToCart(variation.id, 1)).toEqual({ success: true });

    const cart = await db.cart.findUnique({
      where: { guestId: "guest-known" },
      include: { items: true },
    });
    expect(cart).not.toBeNull();
    expect(cart!.userId).toBeNull();
    expect(cart!.items.map((i) => i.variationId)).toEqual([variation.id]);
  });

  it("mints a guest cookie for a brand-new visitor and puts the line there", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await createTestProduct();

    expect(state.jar.has(GUEST)).toBe(false);
    expect(await addToCart(variation.id, 2)).toEqual({ success: true });

    const guestId = state.jar.get(GUEST);
    expect(guestId).toBeTruthy();
    const cart = await db.cart.findUnique({
      where: { guestId: guestId as string },
      include: { items: true },
    });
    expect(cart!.items[0].quantity).toBe(2);
  });

  it("resolves a signed-in caller to their userId cart instead", async () => {
    const user = await createTestUser();
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-should-not-be-used");

    expect(await addToCart(variation.id, 1)).toEqual({ success: true });

    const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart).not.toBeNull();
    expect(cart!.guestId).toBeNull();
    expect(await db.cart.count()).toBe(1); // no second, guest-owned cart
  });
});

describe("removeCartItem", () => {
  it("deletes the line outright (qty 0 → remove)", async () => {
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-remove");
    await addToCart(variation.id, 2);
    const cart = await db.cart.findUniqueOrThrow({ where: { guestId: "guest-remove" } });
    const item = await lineFor(cart.id, variation.id);
    expect(item).not.toBeNull();

    const result = await removeCartItem(item!.id);

    expect(result).toEqual({ success: true });
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.cart.count()).toBe(1); // the cart itself survives
  });

  it("returns the same generic refusal for someone else's line and for a missing id", async () => {
    const victim = await createTestUser();
    const stranger = await createTestUser();
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-owner");
    await addToCart(variation.id, 1);
    const guestCart = await db.cart.findUniqueOrThrow({ where: { guestId: "guest-owner" } });
    const guestLine = await lineFor(guestCart.id, variation.id);
    await db.cart.update({ where: { id: guestCart.id }, data: { userId: victim.id, guestId: null } });

    // Signed in as someone else entirely.
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const foreign = await removeCartItem(guestLine!.id);
    const missing = await removeCartItem("cart-item-that-never-existed");

    expect(foreign).toEqual(missing); // no existence oracle
    expect(foreign.success).toBe(false);
    if (!foreign.success) expect(foreign.error).toBe("Item not found in your cart.");
    expect(await db.cartItem.count()).toBe(1);
  });

  it("deletes a line through updateCartItemQuantity with an explicit 0", async () => {
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-qty-zero");
    await addToCart(variation.id, 3);
    const cart = await db.cart.findUniqueOrThrow({ where: { guestId: "guest-qty-zero" } });
    const item = await lineFor(cart.id, variation.id);

    expect(await updateCartItemQuantity(item!.id, 0)).toEqual({ success: true });
    expect(await db.cartItem.count()).toBe(0);
  });
});
