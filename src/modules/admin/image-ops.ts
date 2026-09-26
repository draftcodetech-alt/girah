import { db } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

/**
 * Phase 11 image core — extracted from the "use server" wrapper (same pattern
 * as variation-ops.ts) so validation order and DB effects are unit/integration
 * testable without Next request context. Auth is the caller's job.
 *
 * Everything that can fail cheaply (product exists, image cap, type, size) is
 * checked BEFORE a byte is uploaded, and Cloudinary is configured lazily so
 * importing this module never requires credentials (builds/tests run without
 * them; a missing key surfaces as a friendly action error, not a crash).
 */

export const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024; // stays under the 4mb server-action body limit
export const MAX_IMAGES_PER_PRODUCT = 10;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export type ImageOpResult =
  | { success: true; productId: string; slug: string }
  | { success: false; error: string };

let cloudinaryConfigured = false;

function ensureCloudinary() {
  if (cloudinaryConfigured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  cloudinaryConfigured = true;
}

function uploadBuffer(buffer: Buffer): Promise<string> {
  ensureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "girah", resource_type: "image" },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed."));
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

/** `…/image/upload/v1789…/girah/name.png` → `girah/name` (for destroy). */
function publicIdFromUrl(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/upload\/(?:v\d+\/)?(.+?)\.[^/.]+$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function uploadImageCore(
  productId: string,
  file: File | null | undefined
): Promise<ImageOpResult> {
  if (!productId) return { success: false, error: "Product not found." };

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true },
  });
  if (!product) return { success: false, error: "Product not found." };

  const existingCount = await db.productImage.count({ where: { productId } });
  if (existingCount >= MAX_IMAGES_PER_PRODUCT) {
    return {
      success: false,
      error: `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`,
    };
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    return { success: false, error: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { success: false, error: "Only JPEG, PNG, WebP, AVIF or GIF images are allowed." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { success: false, error: "Image must be smaller than 3.5 MB." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadBuffer(buffer);
    const maxRow = await db.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await db.productImage.create({
      data: { productId, url, sortOrder: (maxRow?.sortOrder ?? -1) + 1 },
    });
    return { success: true, productId: product.id, slug: product.slug };
  } catch (error) {
    console.error("uploadImageCore failed:", error);
    return {
      success: false,
      error: "Upload failed — check the Cloudinary configuration and try again.",
    };
  }
}

export async function deleteImageCore(imageId: string): Promise<ImageOpResult> {
  const image = await db.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { id: true, slug: true } } },
  });
  if (!image) return { success: false, error: "Image not found." };

  await db.productImage.delete({ where: { id: imageId } });

  // Best-effort remote cleanup: a missing key, dead network or an asset that
  // was already removed must NEVER fail the (already successful) delete.
  const publicId = publicIdFromUrl(image.url);
  if (publicId) {
    try {
      ensureCloudinary();
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (error) {
      console.warn("Cloudinary destroy skipped:", error instanceof Error ? error.message : error);
    }
  }

  return { success: true, productId: image.product.id, slug: image.product.slug };
}

/**
 * Rewrites sortOrder as 0..n-1 with this image pinned first/last. One
 * transaction so concurrent moves can't observe a half-updated order.
 */
export async function moveImageCore(
  imageId: string,
  position: "first" | "last"
): Promise<ImageOpResult> {
  const image = await db.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { id: true, slug: true } } },
  });
  if (!image) return { success: false, error: "Image not found." };

  const others = await db.productImage.findMany({
    where: { productId: image.productId, id: { not: imageId } },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const orderedIds =
    position === "first"
      ? [imageId, ...others.map((other) => other.id)]
      : [...others.map((other) => other.id), imageId];

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.productImage.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return { success: true, productId: image.product.id, slug: image.product.slug };
}
