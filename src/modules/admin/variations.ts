"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import type { AdminActionResult } from "./products";
import {
  variationSchema,
  createVariationSchema,
  type VariationInput,
  type CreateVariationInput,
} from "./schema";
import { fieldErrorsFrom } from "./field-errors";

export async function getAdminVariations() {
  await requireAdmin();
  return db.productVariation.findMany({
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
  });
}

// Phase 11: the missing create half of variation CRUD. Price arrives in
// RUPEES from the form and is stored as integer paisa (Math.round — the same
// float guard as the Phase 5 price filter).
export async function createVariation(
  input: CreateVariationInput
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = createVariationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const { productId, name, price, isEnabled } = parsed.data;
  const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return { success: false, error: "Product not found." };

  try {
    await db.productVariation.create({
      data: {
        productId,
        name,
        price: Math.round(price * 100),
        isEnabled,
      },
    });
  } catch (error) {
    console.error("createVariation failed:", error);
    return { success: false, error: "Something went wrong creating the variation. Please try again." };
  }

  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/shop");
  return { success: true };
}

export async function updateVariation(id: string, input: VariationInput): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = variationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const variation = await db.productVariation.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/catalog");
  const product = await db.product.findUnique({ where: { id: variation.productId } });
  if (product) revalidatePath(`/product/${product.slug}`);
  revalidatePath("/shop");
  // Phase 5: cart lines render per-variation availability live — a disable
  // toggle must refresh open carts, not just the catalog.
  revalidatePath("/cart");
  return { success: true };
}
