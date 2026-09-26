"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";
import { variationSchema, type VariationInput, type StockAdjustmentInput } from "./schema";
import { adjustStockCore } from "./variation-ops";

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
  // Phase 5: cart lines render per-variation availability live — a disable
  // toggle must refresh open carts, not just the catalog.
  revalidatePath("/cart");
  return { success: true };
}

// The ONLY way stock changes — every call creates an audit row alongside
// the actual update, inside one transaction.
export async function adjustStock(variationId: string, input: StockAdjustmentInput): Promise<AdminActionResult> {
  const session = await requireAdmin();
  const result = await adjustStockCore(variationId, input, session.user.id);
  if (!result.success) return result;

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