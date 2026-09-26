"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { deleteImageCore, moveImageCore, uploadImageCore, type ImageOpResult } from "./image-ops";

// Every image mutation touches the admin list (thumbnail), the admin edit page,
// the storefront product page and the shop card (first image = card cover).
function revalidateImageTargets(productId: string, slug: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/product/${slug}`);
  revalidatePath("/shop");
}

/** FormData carries a hidden `productId` + a `file` input (files only travel this way). */
export async function uploadProductImage(formData: FormData): Promise<ImageOpResult> {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  const result = await uploadImageCore(productId, file instanceof File ? file : null);
  if (result.success) revalidateImageTargets(result.productId, result.slug);
  return result;
}

export async function deleteProductImage(imageId: string): Promise<ImageOpResult> {
  await requireAdmin();
  const result = await deleteImageCore(imageId);
  if (result.success) revalidateImageTargets(result.productId, result.slug);
  return result;
}

export async function moveProductImage(
  imageId: string,
  position: "first" | "last"
): Promise<ImageOpResult> {
  await requireAdmin();
  const result = await moveImageCore(imageId, position);
  if (result.success) revalidateImageTargets(result.productId, result.slug);
  return result;
}
