import { z } from "zod";
import { shippingFields } from "@/modules/addresses";

export const checkoutSchema = z.object({
  // Shipping fields come from the addresses module so /account/addresses
  // and checkout can never drift apart (Phase 12).
  ...shippingFields,
  email: z.string().trim().email("Please enter a valid email address"),
  deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.enum(["COD", "SAFEPAY"]),
  // Optional "save as my shipping address" checkbox — only ever upserted
  // for signed-in users, after the order has already committed.
  saveAddress: z.boolean().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
