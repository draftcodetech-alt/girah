"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";

// Explicit `select` everywhere in this file — passwordHash is NEVER included,
// by construction, not by remembering to strip it after the fact.
const SAFE_CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
} as const;

export async function getAdminCustomers(search?: string) {
  await requireAdmin();
  return db.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { ...SAFE_CUSTOMER_SELECT, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminCustomerById(id: string) {
  await requireAdmin();

  const customer = await db.user.findUnique({
    where: { id, role: "CUSTOMER" },
    select: SAFE_CUSTOMER_SELECT,
  });
  if (!customer) return null;

  const orders = await db.order.findMany({
    where: { userId: id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const savedShipping = await db.savedShipping.findUnique({ where: { userId: id } });

  return { customer, orders, savedShipping };
}

export async function toggleCustomerActive(id: string): Promise<AdminActionResult> {
  await requireAdmin();

  const user = await db.user.findUnique({ where: { id }, select: { isActive: true, role: true } });
  if (!user) return { success: false, error: "Customer not found." };

  // Phase 4 L3: the list/detail queries filter role: CUSTOMER, but a server
  // action is invokable by raw id — this path must never disable an admin
  // account (self-inflicted lockouts included).
  if (user.role !== "CUSTOMER") {
    return { success: false, error: "Admin accounts cannot be disabled here." };
  }

  // sessionVersion bump kills every live JWT for this account — disabling an
  // account must log it out immediately, not when its 30-day token expires (C2).
  await db.user.update({
    where: { id },
    data: { isActive: !user.isActive, sessionVersion: { increment: 1 } },
  });
  revalidatePath("/admin/customers");
  return { success: true };
}
