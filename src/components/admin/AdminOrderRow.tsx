"use client";

import Link from "next/link";
import { OrderActions } from "./OrderActions";
import { formatPrice } from "@/lib/format";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
};

/**
 * List row: identity + link into the Phase 13 detail page; ALL controls
 * (status select, Mark Paid, Refund) live in the shared OrderActions so
 * the list and the detail page can never drift apart.
 */
export function AdminOrderRow({ order }: { order: Order }) {
  return (
    <div className="py-4 border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/admin/orders/${order.id}`}
            className="font-body text-body font-medium text-charcoal hover:text-sage underline-offset-2 hover:underline"
          >
            #{order.orderNumber}
          </Link>
          <p className="font-body text-small text-muted mt-1">
            {order.customerName} · {formatPrice(order.total)} · {order.paymentMethod} ·{" "}
            {order.orderStatus}
          </p>
        </div>
        <OrderActions order={order} compact />
      </div>
    </div>
  );
}
