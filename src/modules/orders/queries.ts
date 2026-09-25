import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderView } from "./types";

// Owner-or-bearer access (Phase 4 M5):
// - Guest order (userId null): the cuid IS the unguessable bearer reference
//   for the confirmation page — guest checkout has no account to check
//   ownership against, so holding the fresh link is the credential.
// - Account order (userId set): the confirmation URL must not leak the
//   customer's name/address/items to anyone but its owner — require a
//   session whose user id matches; missing session or mismatch -> null,
//   which the page turns into a 404.
export async function getOrderById(id: string): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return null;

  if (order.userId) {
    const session = await auth();
    if (!session?.user || session.user.id !== order.userId) return null;
  }

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