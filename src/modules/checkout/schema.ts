import { z } from "zod";

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  phone: z.string().trim().min(1, "Phone number is required").max(30),
  email: z.string().trim().email("Please enter a valid email address"),
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(100),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.enum(["COD", "SAFEPAY"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
