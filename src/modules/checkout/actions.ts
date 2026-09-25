"use server";
import { createSafepayCheckoutUrl } from "@/modules/payments/safepay";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { resolveCartIdentity } from "@/modules/cart/identity";
import { checkoutSchema, type CheckoutInput } from "./schema";
import { priceCartItemsFresh, UnavailableVariationError, InvalidQuantityError } from "./pricing";
import { decrementStockForItems, InsufficientStockError } from "./stock";

export type PlaceOrderResult =
  | { success: true; orderNumber: string; orderId: string; checkoutUrl?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// Random, not counter-based — deliberately avoids any shared-sequence race
// condition between concurrent orders. Collision probability is negligible.
function generateOrderNumber(): string {
  return `GIR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const identity = await resolveCartIdentity();
  const session = await auth();

  const cart = await db.cart.findFirst({ where: identity, include: { items: true } });
  if (!cart || cart.items.length === 0) {
    return { success: false, error: "Your cart is empty." };
  }
  const cartItems = cart.items.map((i) => ({ variationId: i.variationId, quantity: i.quantity }));

  try {
    const order = await db.$transaction(
      async (tx) => {
        const { lines, subtotal } = await priceCartItemsFresh(tx, cartItems);
        await decrementStockForItems(tx, cartItems);

        const newOrder = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: session?.user?.id,
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
        });

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return newOrder;
      },
      { maxWait: 5000, timeout: 10000 } // sane transaction timeout — never hangs indefinitely
    );

    revalidatePath("/", "layout");

    if (data.paymentMethod === "SAFEPAY") {
      try {
        const checkoutUrl = await createSafepayCheckoutUrl({
          orderId: order.id,
          amountInPaisa: order.total,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}/confirmation`,
          cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
        });
        return { success: true, orderNumber: order.orderNumber, orderId: order.id, checkoutUrl };
      } catch (safepayError) {
        // Order + stock decrement already succeeded and committed — a Safepay
        // API failure here must NOT be presented as a failed order. The
        // customer can still pay via the order's confirmation/retry path later.
        console.error("Safepay checkout URL generation failed:", safepayError);
        return { success: true, orderNumber: order.orderNumber, orderId: order.id };
      }
    }

    return { success: true, orderNumber: order.orderNumber, orderId: order.id };
  } catch (error) {
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
    console.error("placeOrder failed:", error);
    return { success: false, error: "We couldn't place your order. Please try again." };
  }
}