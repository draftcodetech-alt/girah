import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderView } from "./types";

// No ownership check here deliberately: guest checkout has no account to check
// ownership against, and the order's cuid functions as an unguessable bearer
// reference for the confirmation page — the same pattern most stores use.
// A LOGGED-IN customer's "My Orders" list (Phase 7) DOES need an ownership
// check, since that's browsing by ID predictably, not landing via a fresh order.
export async function getOrderById(id: string): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variationName: i.variationName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
  };
}

export async function getMyOrders(): Promise<OrderView[]> {
  const session = await auth();
  if (!session?.user) return [];

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variationName: i.variationName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
  }));
}

// The IDOR-protected version — used by the authenticated Order Details page.
// Unlike getOrderById (used only by the just-placed-order confirmation flow),
// this REQUIRES the order to belong to the currently logged-in user.
export async function getMyOrderById(id: string): Promise<OrderView | null> {
  const session = await auth();
  if (!session?.user) return null;

  const order = await db.order.findFirst({
    where: { id, userId: session.user.id },
    include: { items: true },
  });
  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variationName: i.variationName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
  };
}