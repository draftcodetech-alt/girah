import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { addToCart, removeCartItem, updateCartItemQuantity } from "@/modules/cart/actions";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 1 integration: the cart action WRAPPERS (not the cores) — the layer
// that owns request context: session resolution, the availability re-check
// that runs on every add regardless of what the client claims it sent, and (since the
// owner's no-guest-buying change) the refusal that keeps carts account-only.
// The guest-cookie identity still exists for the merge path on login; it is
// simply no longer reachable from addToCart.

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

// Since the no-guest-buying change every add runs in a session; lookups are
// by userId, never the guest cookie.
async function signInAs(email: string) {
  const user = await createTestUser({ email });
  authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
  return user;
}

async function lineForUser(userId: string, variationId: string) {
  const cart = await db.cart.findUniqueOrThrow({ where: { userId } });
  return lineFor(cart.id, variationId);
}

beforeEach(async () => {
  await resetDb();
  state.jar.clear();
  state.revalidated.length = 0;
  authMock.mockReset().mockResolvedValue(null);
});

describe("addToCart — server-side availability rules", () => {
  it("merges quantities with no stock ceiling (only the 999 payload cap)", async () => {
    const { variation } = await createTestProduct();
    const user = await signInAs("cap@girah.test");

    expect(await addToCart(variation.id, 3)).toEqual({ success: true });
    let line = await lineForUser(user.id, variation.id);
    expect(line?.quantity).toBe(3);

    // 3 + 4 = 7 — the old stock clamp (min with 5) is gone by spec.
    expect(await addToCart(variation.id, 4)).toEqual({ success: true });
    line = await lineForUser(user.id, variation.id);
    expect(line?.quantity).toBe(7);
    expect(state.revalidated.length).toBe(2);
  });

  it("refuses a disabled variation without creating a line", async () => {
    const { variation } = await createTestProduct();
    await db.productVariation.update({ where: { id: variation.id }, data: { isEnabled: false } });
    await signInAs("disabled@girah.test");

    const result = await addToCart(variation.id, 1);

    expect(result).toEqual({ success: false, error: "This item is no longer available." });
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.cart.count()).toBe(0);
  });

  it("refuses a variation that does not exist", async () => {
    await createTestProduct(); // a real catalogue exists; the id below is fabricated
    await signInAs("out@girah.test");

    expect(await addToCart("variation-that-never-existed", 1)).toEqual({
      success: false,
      error: "This item is no longer available.",
    });
    expect(await db.cartItem.count()).toBe(0);
  });

  it("rejects quantities the client should never have sent", async () => {
    const { variation } = await createTestProduct();
    const user = await signInAs("bad-qty@girah.test");

    for (const bad of [0, -3, 1.5, Number.NaN, 1_000]) {
      expect(await addToCart(variation.id, bad)).toEqual({ success: false, error: "Invalid quantity." });
    }
    expect(await db.cart.count()).toBe(0);
    expect(user.id).toBeTruthy();
  });
});

describe("no guest buying", () => {
  it("refuses a signed-out addToCart outright, with no cookie minted", async () => {
    authMock.mockResolvedValue(null);
    const { variation } = await createTestProduct();
    expect(state.jar.has(GUEST)).toBe(false);

    expect(await addToCart(variation.id, 1)).toEqual({
      success: false,
      error: "You must be signed in.",
    });

    // The refusal happens before identity resolution, so no girah_guest_id
    // is set on the way to being turned away.
    expect(state.jar.has(GUEST)).toBe(false);
    expect(await db.cart.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(0);
  });

  it("refuses even when a guest cookie is already present", async () => {
    const { variation } = await createTestProduct();
    authMock.mockResolvedValue(null);
    state.jar.set(GUEST, "guest-preexisting");

    expect(await addToCart(variation.id, 1)).toEqual({
      success: false,
      error: "You must be signed in.",
    });
    // The stale cookie is left alone but nothing lands in a guest cart.
    expect(await db.cart.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(0);
  });
});

describe("cart identity", () => {
  it("resolves a signed-in caller to their userId cart, never a guest one", async () => {
    const user = await signInAs("identity@girah.test");
    const { variation } = await createTestProduct();
    state.jar.set(GUEST, "guest-should-not-be-used");

    expect(await addToCart(variation.id, 1)).toEqual({ success: true });

    const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart).not.toBeNull();
    expect(cart!.guestId).toBeNull();
    expect(cart!.items.map((i) => i.variationId)).toEqual([variation.id]);
    expect(await db.cart.count()).toBe(1); // no second, guest-owned cart
  });
});

describe("removeCartItem", () => {
  it("deletes the line outright (qty 0 → remove)", async () => {
    const { variation } = await createTestProduct();
    const user = await signInAs("remove@girah.test");
    await addToCart(variation.id, 2);
    const item = await lineForUser(user.id, variation.id);
    expect(item).not.toBeNull();

    const result = await removeCartItem(item!.id);

    expect(result).toEqual({ success: true });
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.cart.count()).toBe(1); // the cart itself survives
  });

  it("returns the same generic refusal for someone else's line and for a missing id", async () => {
    const victim = await signInAs("victim@girah.test");
    const stranger = await createTestUser({ email: "stranger@girah.test" });
    const { variation } = await createTestProduct();
    await addToCart(variation.id, 1);
    const victimLine = await lineForUser(victim.id, variation.id);

    // Signed in as someone else entirely.
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const foreign = await removeCartItem(victimLine!.id);
    const missing = await removeCartItem("cart-item-that-never-existed");

    expect(foreign).toEqual(missing); // no existence oracle
    expect(foreign.success).toBe(false);
    if (!foreign.success) expect(foreign.error).toBe("Item not found in your cart.");
    expect(await db.cartItem.count()).toBe(1);
  });

  it("deletes a line through updateCartItemQuantity with an explicit 0", async () => {
    const { variation } = await createTestProduct();
    const user = await signInAs("qty-zero@girah.test");
    await addToCart(variation.id, 3);
    const item = await lineForUser(user.id, variation.id);

    expect(await updateCartItemQuantity(item!.id, 0)).toEqual({ success: true });
    expect(await db.cartItem.count()).toBe(0);
  });
});
