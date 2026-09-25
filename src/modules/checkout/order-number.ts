import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

// Random, not counter-based — deliberately avoids any shared-sequence race
// condition between concurrent orders. 12 hex chars (16^12 ≈ 2.8e14 space)
// keeps birthday-collision probability negligible even at millions of orders;
// createOrderWithRetriableNumber still guards against the rare collision.
export function generateOrderNumber(): string {
  return `GIR-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function isOrderNumberCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
  return target.toLowerCase().includes("ordernumber");
}

/**
 * Runs `create(orderNumber)` inside `tx`, retrying up to `attempts` times if —
 * and only if — the insert fails on the Order.orderNumber unique constraint.
 *
 * PostgreSQL poisons the entire transaction after a constraint violation
 * ("current transaction is aborted…"), so each attempt is wrapped in a
 * SAVEPOINT: on collision we ROLLBACK TO it and retry with a fresh number,
 * keeping whatever the transaction already did (pricing, stock decrement).
 */
export async function createOrderWithRetriableNumber<T>(
  tx: Prisma.TransactionClient,
  create: (orderNumber: string) => Promise<T>,
  options: { attempts?: number; generate?: () => string } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const generate = options.generate ?? generateOrderNumber;
  let lastCollision: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await tx.$executeRawUnsafe("SAVEPOINT order_number_retry");
    try {
      return await create(generate());
    } catch (error) {
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT order_number_retry");
      if (!isOrderNumberCollision(error)) throw error;
      lastCollision = error;
    }
  }

  throw lastCollision;
}
