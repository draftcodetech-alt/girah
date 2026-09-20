"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";
import { variationSchema, stockAdjustmentSchema, type VariationInput, type StockAdjustmentInput } from "./schema";

export async function getAdminVariations() {
  await requireAdmin();
  return db.productVariation.findMany({
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
  });
}

export async function updateVariation(id: string, input: VariationInput): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = variationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const variation = await db.productVariation.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/variations");
  const product = await db.product.findUnique({ where: { id: variation.productId } });
  if (product) revalidatePath(`/product/${product.slug}`);
  revalidatePath("/shop");
  return { success: true };
}

// The ONLY way stock changes — every call creates an audit row alongside
// the actual update, inside one transaction. girah.md §16.1.
export async function adjustStock(variationId: string, input: StockAdjustmentInput): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  try {
    await db.$transaction(async (tx) => {
      const variation = await tx.productVariation.findUniqueOrThrow({ where: { id: variationId } });
      const newStock = variation.stock + parsed.data.adjustment;

      if (newStock < 0) {
        throw new Error("Adjustment would result in negative stock.");
      }

      await tx.productVariation.update({ where: { id: variationId }, data: { stock: newStock } });
      await tx.stockAdjustment.create({
        data: {
          variationId,
          previousStock: variation.stock,
          adjustment: parsed.data.adjustment,
          newStock,
          reason: parsed.data.reason,
        },
      });
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Adjustment failed." };
  }

  revalidatePath("/admin/variations");
  revalidatePath("/shop");
  return { success: true };
}

export async function getStockAdjustmentHistory(variationId: string) {
  await requireAdmin();
  return db.stockAdjustment.findMany({
    where: { variationId },
    orderBy: { createdAt: "desc" },
  });
}