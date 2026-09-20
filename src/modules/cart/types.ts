export type CartItemView = {
  id: string;
  variationId: string;
  productName: string;
  productSlug: string;
  variationName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  availableStock: number;
};

export type CartView = {
  items: CartItemView[];
  subtotal: number;
};

export type CartActionResult = { success: true } | { success: false; error: string };
