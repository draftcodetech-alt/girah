import { db } from "@/lib/db";
import type { CartIdentity } from "@/modules/cart";
import { priceCartItemsFresh, UnavailableVariationError, InvalidQuantityError } from "./pricing";
import { decrementStockForItems, InsufficientStockError } from "./stock";
import { createOrderWithRetriableNumber } from "./order-number";
import type { CheckoutInput } from "./schema";

export type PlaceOrderResult =
  | { success: true; orderNumber: string; orderId: string; total: number; checkoutUrl?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export class CartAlreadyCheckedOutError extends Error {
  constructor() {
    super("Cart was already checked out.");
    this.name = "CartAlreadyCheckedOutError";
  }
}

/**
 * Core of `placeOrder`, extracted so the duplicate-checkout race can be
 * exercised directly in integration tests — the "use server" action wrapper
 * needs Next request context (cookies + auth), which doesn't exist under
 * plain Node.
 *
 * Duplicate-order guard (Phase 2): a double-submitted checkout may read the
 * same cart twice, so the cart is re-read INSIDE the transaction and emptied
 * with an exactly-counted deleteMany. Under READ COMMITTED, row locks make
 * only one of two racing transactions match the expected count; the loser
 * throws and rolls back — undoing its stock decrement too.
 */
export async function placeOrderCore(
  data: CheckoutInput,
  identity: CartIdentity,
  userId?: string
): Promise<PlaceOrderResult> {
  const cart = await db.cart.findFirst({
    where: identity,
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!cart || cart.items.length === 0) {
    return { success: false, error: "Your cart is empty." };
  }

  try {
    const order = await db.$transaction(
      async (tx) => {
        const freshItems = await tx.cartItem.findMany({
          where: { cartId: cart.id },
          orderBy: { id: "asc" },
        });
        if (freshItems.length === 0) throw new CartAlreadyCheckedOutError();

        const cartItems = freshItems.map((i) => ({ variationId: i.variationId, quantity: i.quantity }));
        const { lines, subtotal } = await priceCartItemsFresh(tx, cartItems);
        await decrementStockForItems(tx, cartItems);

        const newOrder = await createOrderWithRetriableNumber(tx, (orderNumber) =>
          tx.order.create({
            data: {
              orderNumber,
              userId,
              customerName: data.fullName,
              customerEmail: data.email,
              customerPhone: data.phone,
              shippingAddress: data.address,
              shippingCity: data.city,
              shippingPostal: data.postalCode || null,
              deliveryNotes: data.deliveryNotes || null,
              subtotal,
              shipping: 0,
              total: subtotal,
              paymentMethod: data.paymentMethod,
              paymentStatus: "PENDING",
              orderStatus: "CONFIRMED",
              items: {
                create: lines.map((l) => ({
                  variationId: l.variationId,
                  productName: l.productName,
                  variationName: l.variationName,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  subtotal: l.subtotal,
                })),
              },
            },
          })
        );

        const deleted = await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        if (deleted.count !== freshItems.length) throw new CartAlreadyCheckedOutError();

        return newOrder;
      },
      { maxWait: 5000, timeout: 10000 } // sane transaction timeout — never hangs indefinitely
    );

    return { success: true, orderNumber: order.orderNumber, orderId: order.id, total: order.total };
  } catch (error) {
    if (error instanceof CartAlreadyCheckedOutError) {
      return {
        success: false,
        error: "This checkout was already completed. Please review your orders before trying again.",
      };
    }
    if (
      error instanceof InsufficientStockError ||
      error instanceof UnavailableVariationError ||
      error instanceof InvalidQuantityError
    ) {
      return {
        success: false,
        error:
          "Some items are no longer available in the requested quantity. Please review your cart before placing the order.",
      };
    }
    console.error("placeOrderCore failed:", error);
    return { success: false, error: "We couldn't place your order. Please try again." };
  }
}
