import { z } from "zod";

// Shared shipping-address rules — checkoutSchema composes these so the
// /account/addresses form and checkout can never drift apart.
export const shippingFields = {
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  phone: z.string().trim().min(1, "Phone number is required").max(30),
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(100),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
};

export const savedShippingSchema = z.object(shippingFields);

export type SavedShippingInput = z.infer<typeof savedShippingSchema>;

export type SavedShippingView = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string | null;
};
