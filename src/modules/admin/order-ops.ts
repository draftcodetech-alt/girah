import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import type { AdminActionResult } from "./products";
import { orderStatusSchema } from "./schema";

// Allowed order-status transitions (Phase 2). Linear forward path with
// cancellation allowed up to (and including) SHIPPED; DELIVERED and
// CANCELLED are terminal. Anything else is a bogus jump — e.g. skipping
// PROCESSING or resurrecting a cancelled order.
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export class ConcurrentOrderUpdateError extends Error {
  constructor() {
    super("Order was modified concurrently.");
    this.name = "ConcurrentOrderUpdateError";
  }
}

/**
 * Core of `updateOrderStatus`, extracted from the "use server" wrapper so
 * the state machine + restock behaviour can be integration-tested without
 * Next request context. Auth is the caller's job (requireAdmin → adminId).
 */
export async function updateOrderStatusCore(
  orderId: string,
  input: unknown,
  adminId: string
): Promise<AdminActionResult> {
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid status." };
  }
  const next = parsed.data.orderStatus;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  // Same status — idempotent no-op. A double-clicked select must neither
  // fail nor restock a second time.
  if (order.orderStatus === next) {
    return { success: true };
  }

  if (!ALLOWED_TRANSITIONS[order.orderStatus].includes(next)) {
    return { success: false, error: `Cannot move an order from ${order.orderStatus} to ${next}.` };
  }

  // Restock when an unpaid order is cancelled. PAID orders are deliberately
  // excluded: their refund/return path (Phase 3) must own restocking, so
  // stock can never be credited twice for the same order.
  const shouldRestock = next === "CANCELLED" && order.paymentStatus !== "PAID";

  try {
    await db.$transaction(
      async (tx) => {
        // Compare-and-swap on BOTH status and paymentStatus: if another
        // admin or the payment webhook changed the order since we read it,
        // abort instead of restocking on stale assumptions.
        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
          },
          data: { orderStatus: next },
        });
        if (claimed.count === 0) {
          throw new ConcurrentOrderUpdateError();
        }

        if (shouldRestock) {
          // Sorted by variationId — same global lock order as
          // decrementStockForItems, so concurrent cancellations and
          // checkouts can't deadlock on variation rows.
          const restockable = [...order.items].sort((a, b) =>
            a.variationId.localeCompare(b.variationId)
          );
          for (const item of restockable) {
            // Atomic increment; the returned row gives exact audit values
            // (previous = new − adjustment) even under concurrency.
            const variation = await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stock: { increment: item.quantity } },
              select: { stock: true },
            });
            await tx.stockAdjustment.create({
              data: {
                variationId: item.variationId,
                previousStock: variation.stock - item.quantity,
                adjustment: item.quantity,
                newStock: variation.stock,
                reason: `Order ${order.orderNumber} cancelled`,
                adminId,
              },
            });
          }
        }
      },
      { maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (error instanceof ConcurrentOrderUpdateError) {
      return { success: false, error: "This order was changed by someone else. Refresh and try again." };
    }
    console.error("updateOrderStatusCore failed:", error);
    return { success: false, error: "Failed to update the order. Please try again." };
  }

  return { success: true };
}
