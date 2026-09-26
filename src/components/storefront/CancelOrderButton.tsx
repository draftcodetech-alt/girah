"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyOrder } from "@/modules/orders";

/**
 * Two-step confirm (Cancel order → Yes, cancel #1234): only rendered for
 * orders that pass `canCustomerCancel` (unpaid, not yet being prepared),
 * but the server re-validates eligibility — never trusting this render.
 * Success refreshes in place: the button disappears because the order is
 * now CANCELLED, and stock/count revalidations already ran server-side.
 */
export function CancelOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await cancelMyOrder(orderId);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      {confirming ? (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="font-body text-small text-error font-semibold underline"
        >
          {isPending ? "Cancelling…" : `Yes, cancel order #${orderNumber}`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-medium border border-border text-error bg-cream"
        >
          Cancel order
        </button>
      )}
      {error && (
        <span role="alert" className="font-body text-small text-error mt-1 max-w-[320px]">
          {error}
        </span>
      )}
    </span>
  );
}
