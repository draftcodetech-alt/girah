import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getMyOrderForReceipt, getMyOrderById } from "@/modules/orders/queries";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 12: the receipt is the owner-only invoice — full PII (the delivery
// block the detail page deliberately withholds), still indistinguishable
// from a missing order for anyone else.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

let orderCounter = 0;
async function seedOwnedOrder(
  owner: { id: string },
  overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}
) {
  orderCounter += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-RCPT${Date.now()}${orderCounter}`,
      userId: owner.id,
      customerName: "Receipt Tester",
      customerEmail: "receipt@girah.test",
      customerPhone: "03009998887",
      shippingAddress: "House 5, Blue Area",
      shippingCity: "Islamabad",
      shippingPostal: "44000",
      deliveryNotes: "Ring the bell twice",
      subtotal: 25_000,
      total: 25_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

describe("getMyOrderForReceipt", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("is null for a guest session", async () => {
    const owner = await createTestUser();
    const order = await seedOwnedOrder(owner);
    authMock.mockResolvedValue(null);

    expect(await getMyOrderForReceipt(order.id)).toBeNull();
  });

  it("is null for a STRANGER, indistinguishable from a missing id", async () => {
    const owner = await createTestUser({ email: "rcpt-owner@girah.test" });
    const stranger = await createTestUser({ email: "rcpt-stranger@girah.test" });
    authMock.mockResolvedValue({ user: { id: stranger.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);

    expect(await getMyOrderForReceipt(order.id)).toBeNull();
    expect(await getMyOrderForReceipt("definitely-not-an-order")).toBeNull();
  });

  it("returns the full invoice view for the owner", async () => {
    const owner = await createTestUser({ email: "rcpt-owner2@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);
    await db.orderItem.create({
      data: {
        orderId: order.id,
        variationId: (await seedVariation()).id,
        productName: "Bouquet",
        variationName: "Large",
        unitPrice: 25_000,
        quantity: 1,
        subtotal: 25_000,
      },
    });

    const receipt = await getMyOrderForReceipt(order.id);
    expect(receipt).not.toBeNull();
    expect(receipt).toMatchObject({
      orderNumber: order.orderNumber,
      customerName: "Receipt Tester",
      customerEmail: "receipt@girah.test",
      customerPhone: "03009998887",
      shippingAddress: "House 5, Blue Area",
      shippingCity: "Islamabad",
      shippingPostal: "44000",
      deliveryNotes: "Ring the bell twice",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      subtotal: 25_000,
      shipping: 0,
      total: 25_000,
    });
    expect(receipt?.createdAt).toBeInstanceOf(Date);
    expect(receipt?.items).toHaveLength(1);
    expect(receipt?.items[0]).toMatchObject({ productName: "Bouquet", quantity: 1 });
  });

  it("the DETAIL view stays PII-free — contact details only exist on the receipt", async () => {
    const owner = await createTestUser({ email: "rcpt-owner3@girah.test" });
    authMock.mockResolvedValue({ user: { id: owner.id, role: "CUSTOMER" } });
    const order = await seedOwnedOrder(owner);

    const detail = await getMyOrderById(order.id);
    expect(detail).not.toBeNull();
    expect(detail).not.toHaveProperty("customerEmail");
    expect(detail).not.toHaveProperty("customerPhone");
    expect(detail).not.toHaveProperty("shippingPostal");
    expect(detail).not.toHaveProperty("deliveryNotes");
  });
});

async function seedVariation() {
  const category = await db.category.create({
    data: { name: `Rcpt Cat ${Date.now()}`, slug: `rcpt-cat-${Date.now()}` },
  });
  const product = await db.product.create({
    data: {
      name: `Rcpt Product ${Date.now()}`,
      slug: `rcpt-product-${Date.now()}`,
      description: "receipt test",
      categoryId: category.id,
    },
  });
  return db.productVariation.create({
    data: { productId: product.id, name: "Large", price: 25_000, stock: 5 },
  });
}
