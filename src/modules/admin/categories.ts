"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { categorySchema, type CategoryInput } from "./schema";
import { isForeignKeyRestriction, isRecordNotFound } from "./db-errors";
import type { AdminActionResult } from "./products";

export type CategoryActionResult =
  | { success: true; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: readonly PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] = issue.message;
  return fieldErrors;
}

function revalidateCategoryTargets() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  // The storefront footer lists categories on every page.
  revalidatePath("/", "layout");
}

export async function getAdminCategoriesWithCounts() {
  await requireAdmin();
  return db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(input: CategoryInput): Promise<CategoryActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  try {
    const category = await db.category.create({ data: parsed.data });
    revalidateCategoryTargets();
    return { success: true, id: category.id };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return {
        success: false,
        error: "This slug is already taken by another category.",
        fieldErrors: { slug: "This slug is already taken." },
      };
    }
    console.error("createCategory failed:", error);
    return { success: false, error: "Something went wrong creating the category. Please try again." };
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const slugTaken = await db.category.findFirst({
    where: { slug: parsed.data.slug, id: { not: id } },
    select: { id: true },
  });
  if (slugTaken) {
    return {
      success: false,
      error: "This slug is already taken by another category.",
      fieldErrors: { slug: "This slug is already taken." },
    };
  }

  try {
    await db.category.update({ where: { id }, data: parsed.data });
    revalidateCategoryTargets();
    return { success: true };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return { success: false, error: "Category not found." };
    }
    console.error("updateCategory failed:", error);
    return { success: false, error: "Something went wrong saving the category. Please try again." };
  }
}

export async function deleteCategory(id: string): Promise<AdminActionResult> {
  await requireAdmin();

  try {
    await db.category.delete({ where: { id } });
    revalidateCategoryTargets();
    return { success: true };
  } catch (error) {
    // DELETE…RESTRICT arrives as an UNKNOWN Prisma error (Postgres 23001),
    // so check both that shape and the classic P2003/P2014 codes.
    if (isForeignKeyRestriction(error)) {
      return {
        success: false,
        error: "Products still use this category — move them to another category first.",
      };
    }
    if (isRecordNotFound(error)) return { success: false, error: "Category not found." };
    console.error("deleteCategory failed:", error);
    return { success: false, error: "Something went wrong deleting the category. Please try again." };
  }
}
