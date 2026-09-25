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
// can only happen via the verified webhook (technical-design.md §6).
// implementation-plan.md Phase 8 explicitly calls this guard out as a
// required fake-payment prevention, not an incidental restriction.
export async function markCodPaymentReceived(orderId: string): Promise<AdminActionResult> {
  await requireAdmin();

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { success: false, error: "Order not found." };
  }
  if (order.paymentMethod !== "COD") {
    return { success: false, error: "Only Cash on Delivery orders can be marked paid manually." };
  }

  await db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
  revalidatePath("/admin/orders");
  return { success: true };
}
