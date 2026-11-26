import { z } from "zod";

// Shared shipping-address rules — checkoutSchema composes these so the
// /account/addresses form and checkout can never drift apart.
//
// Both fields below feed the order-received email (`Thanks, ${customerName}`)
// and the admin order rows, so markup is refused at the door in addition to
// being escaped at the email sink (defence in depth). The phone rule also
// keeps non-numeric junk out of a field that is only ever dialled.
const noMarkup = (value: string) => !/[<>]/.test(value);

export const shippingFields = {
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(200)
    .refine(noMarkup, "Full name cannot contain < or >"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(30)
    .regex(/^[+\d][\d\s\-()]{5,29}$/, "Please enter a valid phone number"),
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
