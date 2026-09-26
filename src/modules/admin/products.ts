"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { productSchema, type ProductInput } from "./schema";
import { isForeignKeyRestriction, isRecordNotFound } from "./db-errors";

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function getAdminProducts() {
  await requireAdmin();
  return db.product.findMany({
    include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 }, variations: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminProductById(id: string) {
  await requireAdmin();
  return db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } }, variations: true, category: true },
  });
}

export async function getAdminCategories() {
  await requireAdmin();
  return db.category.findMany({ orderBy: { name: "asc" } });
}

export async function createProduct(input: ProductInput): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const existing = await db.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { slug: "This slug is already in use." },
    };
  }

  await db.product.create({ data: parsed.data });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true };
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const slugTaken = await db.product.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (slugTaken) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { slug: "This slug is already in use." },
    };
  }

  await db.product.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/products");
  revalidatePath(`/product/${parsed.data.slug}`);
  revalidatePath("/shop");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<AdminActionResult> {
  await requireAdmin();
  // Images/variations cascade (schema.prisma), but OrderItem.variationId is
  // a LIVE foreign key (restrict) and CartItem.variationId likewise — the
  // frozen productName/variationName fields are extra snapshot metadata, not
  // a substitute for the relation. Products referenced by orders or carts
  // therefore cannot be deleted; surface that as a friendly error instead of
  // an unhandled error. DELETE…RESTRICT arrives as an UNKNOWN Prisma error
  // (Postgres 23001), so isForeignKeyRestriction checks both shapes.
  try {
    await db.product.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyRestriction(error)) {
      return {
        success: false,
        error: "This product can't be deleted because existing orders or carts still reference it.",
      };
    }
    if (isRecordNotFound(error)) {
      return { success: false, error: "Product not found." };
    }
    throw error;
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true };
}
