import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { reorderOrder } from "@/modules/orders/actions";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 12: "Buy again" replays through the ONE addToCart implementation
// (stock checks, disabled lines, qty caps) and reports skipped lines instead
// of silently dropping them. Owner-scoped with the module's anti-enumeration
// error; guests have no account orders to reorder.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MISSING_ERROR = "Order not found.";

let orderCounter = 0;
async function seedOwnedOrder(
  owner: { id: string },
  overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}
) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-ROR${Date.now()}${orderCounter}`,
      userId: owner.id,
      customerName: "Reorder Tester",
      customerEmail: "reorder@girah.test",
      customerPhone: "03001112223",
      shippingAddress: "Street 7",
      shippingCity: "Lahore",
      subtotal: 100_000,
      total: 100_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

async function seedItem(
  orderId: string,
  variationId: string,
  quantity: number,
  names: { productName: string; variationName: string }
) {
  const variation = await db.productVariation.findUniqueOrThrow({ where: { id: variationId } });
  return db.orderItem.create({
    data: {
      orderId,
      variationId,
      productName: names.productName,
      variationName: names.variationName,
      unitPrice: variation.price,
      quantity,
      subtotal: variation.price * quantity,
    },
  });
}

describe("reorderOrder", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("requires a session", async () => {
    authMock.mockResolvedValue(null);
    const owner = await createTestUser();
    const order = await seedOwnedOrder(owner);

    const result = await reorderOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("You must be signed in.");
  });

  it("returns the SAME not-found error for a stranger's order and a missing id", async () => {
    const owner = await createTestUser({ email: "owner-ror@girah.test" });
    const stranger = await createTestUser({ email: "stranger-ror@girah.test" });
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);

    const strangerResult = await reorderOrder(order.id);
    const missingResult = await reorderOrder("definitely-not-an-order");
    expect(strangerResult.success).toBe(false);
    expect(missingResult.success).toBe(false);
    if (!strangerResult.success) expect(strangerResult.error).toBe(MISSING_ERROR);
    if (!missingResult.success) expect(missingResult.error).toBe(MISSING_ERROR);
  });

  it("replays every line into the signed-in user's cart", async () => {
    const owner = await createTestUser({ email: "owner-ror2@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const p1 = await createTestProduct();
    const p2 = await createTestProduct();
    const order = await seedOwnedOrder(owner);
    await seedItem(order.id, p1.variation.id, 2, { productName: "Bouquet", variationName: "Small" });
    await seedItem(order.id, p2.variation.id, 1, { productName: "Keychain", variationName: "Heart" });

    const result = await reorderOrder(order.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.added).toBe(2);
      expect(result.skipped).toEqual([]);
    }

    const cart = await db.cart.findUniqueOrThrow({ where: { userId: owner.id } });
    const lines = await db.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { id: "asc" } });
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.variationId === p1.variation.id)?.quantity).toBe(2);
    expect(lines.find((l) => l.variationId === p2.variation.id)?.quantity).toBe(1);
  });

  it("reports a disabled line as skipped instead of adding it", async () => {
    const owner = await createTestUser({ email: "owner-ror3@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const live = await createTestProduct();
    const disabled = await createTestProduct();
    await db.productVariation.update({
      where: { id: disabled.variation.id },
      data: { isEnabled: false },
    });
    const order = await seedOwnedOrder(owner);
    await seedItem(order.id, live.variation.id, 1, { productName: "Live", variationName: "S" });
    await seedItem(order.id, disabled.variation.id, 1, {
      productName: "Retired Bouquet",
      variationName: "Large",
    });

    const result = await reorderOrder(order.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.added).toBe(1);
      expect(result.skipped).toEqual(["Retired Bouquet — Large"]);
    }

    const cart = await db.cart.findUniqueOrThrow({ where: { userId: owner.id } });
    const lines = await db.cartItem.findMany({ where: { cartId: cart.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0].variationId).toBe(live.variation.id);
  });

  it("fails with the skipped list when NOTHING is available", async () => {
    const owner = await createTestUser({ email: "owner-ror4@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const soldOut = await createTestProduct();
    await db.productVariation.update({ where: { id: soldOut.variation.id }, data: { stock: 0 } });
    const order = await seedOwnedOrder(owner);
    await seedItem(order.id, soldOut.variation.id, 1, {
      productName: "Sold Out Thing",
      variationName: "S",
    });

    const result = await reorderOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/None of this order's items are available/);
      expect(result.skipped).toEqual(["Sold Out Thing — S"]);
    }
    // addToCart refuses the out-of-stock line BEFORE any cart row exists.
    const cart = await db.cart.findFirst({ where: { userId: owner.id } });
    if (cart) expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
  });

  it("refuses an order with no items", async () => {
    const owner = await createTestUser({ email: "owner-ror5@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);

    const result = await reorderOrder(order.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("This order has no items to reorder.");
  });
});
