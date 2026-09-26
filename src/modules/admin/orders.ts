"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";
import { type OrderStatusInput } from "./schema";
import { updateOrderStatusCore } from "./order-ops";

export async function getAdminOrders() {
  await requireAdmin();
  return db.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminOrderById(id: string) {
  await requireAdmin();
  return db.order.findUnique({ where: { id }, include: { items: true } });
}

export async function updateOrderStatus(orderId: string, input: OrderStatusInput): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const result = await updateOrderStatusCore(orderId, input, session.user.id);
  if (result.success) {
    revalidatePath("/admin/orders");
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
  return { success: true };
}
