"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, markCodPaymentReceived } from "@/modules/admin";

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

type OrderActionTarget = {
  id: string;
  orderNumber: string;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
};

/**
 * Order controls shared by the list row and the detail page: status select
 * with optimistic rollback and COD-only Mark Paid, laid out as one flex row
 * with a real gap between every control (compact mode tightens the rhythm
 * for list rows). Every refusal from the server surfaces inline.
 *
 * The standalone Refund control was removed as a spec change — refunding a
 * captured Safepay payment still happens automatically when an order is
 * CANCELLED (the status machine), it just isn't a button here anymore.
 */
export function OrderActions({
  order,
  compact = false,
}: {
  order: OrderActionTarget;
  compact?: boolean;
}) {
  const router = useRouter();
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
        orderStatus: newStatus as (typeof STATUSES)[number],
      });
      if (result.success) {
        setStatus(newStatus);
        router.refresh();
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
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const showMarkPaid =
    order.paymentMethod === "COD" && paymentStatus === "PENDING" && status !== "CANCELLED";

  return (
    <div
      className={
        compact ? "flex flex-wrap items-center gap-3" : "flex flex-wrap items-center gap-4"
      }
    >
      <span className="font-body text-small text-muted">Payment: {paymentStatus}</span>

      {showMarkPaid && (
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isPending}
          className="h-10 px-4 rounded-[var(--radius-control)] font-body text-small font-semibold bg-sage text-cream disabled:opacity-60"
        >
          {isPending ? "Marking…" : "Mark Paid"}
        </button>
      )}

      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={isPending}
        aria-label="Order status"
        className="h-10 rounded-[var(--radius-control)] border border-border px-3 font-body text-small bg-cream"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="font-body text-small text-error basis-full">
          {error}
        </p>
      )}
    </div>
  );
}
