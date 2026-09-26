"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus, markCodPaymentReceived } from "@/modules/admin/orders";
import { formatPrice } from "@/lib/format";

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
  const [error, setError] = useState<string | null>(null);

  function handleStatusChange(newStatus: string) {
    const previousStatus = status;
    setStatus(newStatus);
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, {
        orderStatus: newStatus as typeof STATUSES[number],
      });
      if (result.success) {
        setStatus(newStatus);
      } else {
        setStatus(previousStatus);
        setError(result.error);
      }
    });
  }

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markCodPaymentReceived(order.id);
      if (result.success) {
        setPaymentStatus("PAID");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="py-4 border-b border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-body font-medium text-charcoal">#{order.orderNumber}</p>
          <p className="font-body text-small text-muted mt-1">
            {order.customerName} · {formatPrice(order.total)} · {order.paymentMethod}
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
      {error && <p role="alert" className="font-body text-small text-error mt-2">{error}</p>}
    </div>
  );
}
