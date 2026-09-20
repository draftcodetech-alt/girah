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

export const stockAdjustmentSchema = z.object({
  adjustment: z.coerce.number().int(),
  reason: z.string().trim().min(1, "A reason is required"),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;