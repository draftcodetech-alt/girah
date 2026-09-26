export type OrderActionResult =
  | { success: true }
  | { success: false; error: string };

export type OrderView = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  total: number;
  customerName: string;
  shippingAddress: string;
  shippingCity: string;
  createdAt: Date;
  items: {
    variationId: string;
    productName: string;
    variationName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[];
};
