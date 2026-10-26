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
 * (status select, Mark Paid) live in the shared OrderActions so
 * the list and the detail page can never drift apart.
 */
export function AdminOrderRow({ order }: { order: Order }) {
  return (
    <div className="py-4">
      <div className="ax-row-head">
        <div>
          <Link
            href={`/admin/orders/${order.id}`}
            className="ax-row-name hover:text-sage underline-offset-2 hover:underline"
          >
            #{order.orderNumber}
          </Link>
          <p className="ax-row-meta">
            {order.customerName} · {formatPrice(order.total)} · {order.paymentMethod} ·{" "}
            {order.orderStatus}
          </p>
        </div>
        <OrderActions order={order} compact />
      </div>
    </div>
  );
}
