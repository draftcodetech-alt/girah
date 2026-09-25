"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus, markCodPaymentReceived } from "@/modules/admin/orders";

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
};

export function AdminOrderRow({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(order.orderStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      await updateOrderStatus(order.id, { orderStatus: newStatus as typeof STATUSES[number] });
    });
  }

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markCodPaymentReceived(order.id);
      if (result.success) setPaymentStatus("PAID");
    });
  }

  return (
    <div className="flex items-center justify-between py-4 border-b border-border">
      <div>
        <p className="font-body text-body font-medium text-charcoal">#{order.orderNumber}</p>
        <p className="font-body text-small text-muted mt-1">
          {order.customerName} · Rs. {(order.total / 100).toLocaleString("en-PK")} · {order.paymentMethod}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-body text-small text-muted">
          Payment: {paymentStatus}
          {order.paymentMethod === "COD" &&
            paymentStatus === "PENDING" &&
            status !== "CANCELLED" && (
            <button
              onClick={handleMarkPaid}
              disabled={isPending}
              className="ml-2 text-sage font-medium underline"
            >
              Mark Paid
            </button>
          )}
        </span>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={isPending}
          className="h-10 rounded-[var(--radius-control)] border border-border px-3 font-body text-small bg-cream"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
