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
  // Phase 5 disabled-line UX: false when an admin disabled the variation
  // after it was added — the cart renders an "Unavailable" badge for it.
  isEnabled: boolean;
};

export type CartView = {
  items: CartItemView[];
  subtotal: number;
};

export type CartActionResult = { success: true } | { success: false; error: string };
