import { describe, it, expect, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createOrderWithRetriableNumber, generateOrderNumber } from "@/modules/checkout/order-number";
import { resetDb } from "../setup/helpers";

// Phase 2: order-number collision handling. A duplicate must roll back to a
// SAVEPOINT (not poison the transaction) and retry with a fresh number.

const orderFields = {
  customerName: "Retry Tester",
  customerEmail: "retry@girah.test",
  customerPhone: "03000000000",
  shippingAddress: "Street 9",
  shippingCity: "Lahore",
  subtotal: 0,
  total: 0,
  paymentMethod: "COD" as const,
};

function createOrder(tx: Prisma.TransactionClient, orderNumber: string) {
  return tx.order.create({ data: { ...orderFields, orderNumber } });
}

describe("createOrderWithRetriableNumber", () => {
  beforeEach(resetDb);

  it("retries after a colliding number and leaves the transaction usable", async () => {
    // Occupy the first number the generator will hand out.
    await db.order.create({ data: { ...orderFields, orderNumber: "GIR-COLLIDE000001" } });

    const numbers = ["GIR-COLLIDE000001", generateOrderNumber()];
    let i = 0;
    const generate = () => numbers[i++] ?? generateOrderNumber();

    const { order, category } = await db.$transaction(async (tx) => {
      const created = await createOrderWithRetriableNumber(tx, (n) => createOrder(tx, n), {
        generate,
      });
      // Proof the transaction survived the savepoint rollback (PG would
      // otherwise reject this with "current transaction is aborted").
      const post = await tx.category.create({
        data: { name: "post-retry", slug: "post-retry" },
      });
      return { order: created, category: post };
    });

    expect(order.orderNumber).toMatch(/^GIR-[0-9A-F]{12}$/);
    expect(order.orderNumber).not.toBe("GIR-COLLIDE000001");
    expect(category.slug).toBe("post-retry");
    expect(await db.order.count()).toBe(2);
  });

  it("does not retry non-collision errors", async () => {
    await expect(
      db.$transaction((tx) =>
        createOrderWithRetriableNumber(tx, () => Promise.reject(new Error("boom")), {})
      )
    ).rejects.toThrow("boom");
  });

  it("gives up after exhausting attempts with the original collision error", async () => {
    await db.order.create({ data: { ...orderFields, orderNumber: "GIR-COLLIDE000001" } });

    const error = await db
      .$transaction((tx) =>
        createOrderWithRetriableNumber(tx, (n) => createOrder(tx, n), {
          attempts: 3,
          generate: () => "GIR-COLLIDE000001",
        })
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    expect(await db.order.count()).toBe(1); // only the pre-seeded order remains
  });
});
