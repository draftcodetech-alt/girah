import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import { refundSafepayPayment } from "@/modules/payments";
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
 * the state machine + refund + restock behaviour can be integration-tested
 * without Next request context. Auth is the caller's job (requireAdmin →
 * adminId). Cancelling a PAID order issues the refund BEFORE mutating state.
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

  const wasPaid = order.paymentStatus === "PAID";
  let refundIssued = false;

  // Cancelling a PAID order must return the money BEFORE any state changes:
  //  - Safepay: call the refund API; if it fails the cancellation is refused
  //    and the order is left untouched (never cancel without refunding).
  //  - COD: staff return cash offline, so cancellation itself records the
  //    money as returned (paymentStatus -> REFUNDED below).
  // Unpaid orders (PENDING/FAILED/REFUNDED) need no refund call.
  if (next === "CANCELLED" && wasPaid && order.paymentMethod === "SAFEPAY") {
    if (!order.safepayTracker) {
      return {
        success: false,
        error:
          "This paid order has no Safepay payment reference recorded. Refund it from the Safepay dashboard first — once it shows REFUNDED, cancel it here (the order will restock).",
      };
    }
    try {
      await refundSafepayPayment(order.safepayTracker, order.total);
      refundIssued = true;
    } catch (error) {
      console.error(`Safepay refund refused for order ${order.orderNumber}:`, error);
      return {
        success: false,
        error:
          "Safepay rejected the refund — the order was NOT cancelled and nothing changed. Resolve the payment issue and try again.",
      };
    }
  }

  // Restock on EVERY cancellation. The old "skip if PAID" carve-out existed
  // only because refunds weren't wired up yet; with the refund path in place,
  // CANCELLED always pairs with returned stock (REFUNDED is distinct from
  // PAID, so the CAS below keeps an already-refunded payment status intact).
  const shouldRestock = next === "CANCELLED";

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
          data: {
            orderStatus: next,
            // A cancelled PAID order now holds no captured money: Safepay
            // refund succeeded above (or COD cash returned offline).
            ...(next === "CANCELLED" && wasPaid ? { paymentStatus: "REFUNDED" as const } : {}),
          },
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
                reason: `Order ${order.orderNumber} cancelled${wasPaid ? " — payment refunded" : ""}`,
                adminId,
              },
            });
          }
        }
      },
      { maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (refundIssued) {
      // The refund is already on its way out — state may now disagree with
      // the money. Loud log for reconciliation, whatever the failure was.
      console.error(
        `CRITICAL: refund issued for order ${order.orderNumber} (tracker ${order.safepayTracker}) but the cancellation could not be committed:`,
        error
      );
      return {
        success: false,
        error:
          "The refund was issued but the order could not be updated — verify the refund in the Safepay dashboard, then contact support.",
      };
    }
    if (error instanceof ConcurrentOrderUpdateError) {
      return { success: false, error: "This order was changed by someone else. Refresh and try again." };
    }
    console.error("updateOrderStatusCore failed:", error);
    return { success: false, error: "Failed to update the order. Please try again." };
  }

  return { success: true };
}
