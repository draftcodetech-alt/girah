import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().min(1, "Description is required"),
  categoryId: z.string().min(1, "Category is required"),
});
export type ProductInput = z.infer<typeof productSchema>;

export const variationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  price: z.coerce.number().int().min(1, "Price must be greater than 0"),
  isEnabled: z.boolean(),
});
export type VariationInput = z.infer<typeof variationSchema>;

// Phase 11: creating a variation also pins it to a product and seeds stock.
// `price` arrives in RUPEES from the form and is converted to integer paisa
// server-side (Math.round — never float multiplication that leaks decimals).
export const createVariationSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  name: z.string().trim().min(1, "Name is required").max(100),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  isEnabled: z.boolean(),
});
export type CreateVariationInput = z.infer<typeof createVariationSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const stockAdjustmentSchema = z.object({
  adjustment: z.coerce.number().int(),
  reason: z.string().trim().min(1, "A reason is required"),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
