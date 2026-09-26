import { z } from "zod";

export const orderStatusSchema = z.object({
  orderStatus: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
