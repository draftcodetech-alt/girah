"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { refundSafepayPayment } from "@/modules/payments";
import type { AdminActionResult } from "./products";
import type { AdminOrderFilters } from "./types";
import { updateOrderStatusCore, type OrderStatusInput } from "@/modules/orders";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export async function getAdminOrders(filters: AdminOrderFilters = {}) {
  await requireAdmin();

  const where: Prisma.OrderWhereInput = {};
  if (filters.status && (ORDER_STATUSES as readonly string[]).includes(filters.status)) {
    where.orderStatus = filters.status as (typeof ORDER_STATUSES)[number];
  }
  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  return db.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminOrderById(id: string) {
  await requireAdmin();
  return db.order.findUnique({
    where: { id },
    include: { items: true, user: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateOrderStatus(orderId: string, input: OrderStatusInput): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const result = await updateOrderStatusCore(orderId, input, session.user.id);
  if (result.success) {
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
  }
  return result;
}

// COD-ONLY. This function deliberately has NO parameter or code path that
// could ever set an ONLINE (Safepay) order's paymentStatus to PAID — that
// can only happen via the verified webhook. This guard is a required
// fake-payment prevention, not an incidental restriction.
export async function markCodPaymentReceived(orderId: string): Promise<AdminActionResult> {
  await requireAdmin();

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { success: false, error: "Order not found." };
  }
  if (order.paymentMethod !== "COD") {
    return { success: false, error: "Only Cash on Delivery orders can be marked paid manually." };
  }
  // Phase 4 M2: PAID/REFUNDED are terminal (webhook CAS invariants + audit
  // trail) and a CANCELLED order must not read as paid afterwards. Only the
  // live PENDING -> PAID transition is legal.
  if (order.orderStatus === "CANCELLED") {
    return { success: false, error: "Cancelled orders cannot be marked paid." };
  }
  if (order.paymentStatus !== "PENDING") {
    return {
      success: false,
      error: `Payment is already ${order.paymentStatus} — it cannot be marked paid manually.`,
    };
  }

  // CAS on paymentStatus so two admins racing (or the row changing between
  // the read above and this write) can never double-apply the transition.
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: "PENDING" },
    data: { paymentStatus: "PAID" },
  });
  if (updated.count === 0) {
    return { success: false, error: "Payment status changed — reload the page and try again." };
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

/**
 * Phase 13: standalone refund — money back, order KEPT (status untouched,
 * no restock; the webhook's PAID→REFUNDED CAS has the same semantics). The
 * inverse of markCodPaymentReceived: only a live PAID payment can move.
 *
 * Safepay orders call the refund API BEFORE any state change — never flip
 * to REFUNDED unless the money actually moved (same ordering as the cancel
 * branch in updateOrderStatusCore). COD refunds are staff returning cash
 * offline, so the state flip IS the record. No restock: the goods are not
 * coming back (a return-then-restock goes through CANCELLED instead).
 */
export async function refundOrderPayment(orderId: string): Promise<AdminActionResult> {
  await requireAdmin();

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { success: false, error: "Order not found." };
  }
  if (order.paymentStatus === "REFUNDED") {
    return { success: false, error: "This payment has already been refunded." };
  }
  if (order.paymentStatus !== "PAID") {
    return {
      success: false,
      error: `Only a PAID payment can be refunded — this order is ${order.paymentStatus}.`,
    };
  }

  if (order.paymentMethod === "SAFEPAY") {
    if (!order.safepayTracker) {
      return {
        success: false,
        error:
          "This paid order has no Safepay payment reference recorded. Refund it from the Safepay dashboard first — once it shows REFUNDED, this page will agree.",
      };
    }
    try {
      await refundSafepayPayment(order.safepayTracker, order.total);
    } catch (error) {
      console.error(`Safepay refund refused for order ${order.orderNumber}:`, error);
      return {
        success: false,
        error:
          "Safepay rejected the refund — the order was NOT changed and nothing moved. Resolve the payment issue and try again.",
      };
    }
  }

  // CAS: another admin (or the webhook) may have changed the row while the
  // refund call was in flight — never overwrite a concurrent transition.
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: "PAID" },
    data: { paymentStatus: "REFUNDED" },
  });
  if (updated.count === 0) {
    return { success: false, error: "Payment status changed — reload the page and try again." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
