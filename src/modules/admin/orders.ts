"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
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
  await requireAdmin();
  const result = await updateOrderStatusCore(orderId, input);
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
