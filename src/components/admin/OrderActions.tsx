"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, markCodPaymentReceived, refundOrderPayment } from "@/modules/admin";
import { formatPrice } from "@/lib/format";

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
 * Order controls shared by the list row and the detail page (Phase 13 adds
 * the standalone Refund here): status select with optimistic rollback,
 * COD-only Mark Paid, and a two-step Refund that only appears while the
 * payment is PAID. Every refusal from the server surfaces inline.
 */
export function OrderActions({
  order,
  compact = false,
  allowRefund = false,
}: {
  order: OrderActionTarget;
  compact?: boolean;
  /** Refund is a detail-page control only (Phase 13 plan) — the list row never offers it. */
  allowRefund?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(order.orderStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRefund, setConfirmingRefund] = useState(false);

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

  function handleRefund() {
    setError(null);
    setConfirmingRefund(false);
    startTransition(async () => {
      const result = await refundOrderPayment(order.id);
      if (result.success) {
        setPaymentStatus("REFUNDED");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const showMarkPaid =
    order.paymentMethod === "COD" && paymentStatus === "PENDING" && status !== "CANCELLED";
  const showRefund = allowRefund && paymentStatus === "PAID";

  return (
    <div className={compact ? "" : "flex flex-wrap items-center gap-4"}>
      <span className="font-body text-small text-muted">
        Payment: {paymentStatus}
        {showMarkPaid && (
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={isPending}
            className="ml-2 text-sage font-medium underline"
          >
            Mark Paid
          </button>
        )}
      </span>

      {showRefund &&
        (confirmingRefund ? (
          <span className="inline-flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefund}
              disabled={isPending}
              className="h-10 px-4 rounded-[var(--radius-control)] font-body text-small font-semibold bg-error text-cream disabled:opacity-60"
            >
              {isPending ? "Refunding…" : `Yes, refund ${formatPrice(order.total)}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRefund(false)}
              disabled={isPending}
              className="font-body text-small text-muted underline"
            >
              Keep payment
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRefund(true)}
            disabled={isPending}
            className="h-10 px-4 rounded-[var(--radius-control)] font-body text-small font-medium border border-border text-error bg-cream"
          >
            Refund
          </button>
        ))}

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
