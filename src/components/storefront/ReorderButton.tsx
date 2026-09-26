"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderOrder } from "@/modules/orders";

/**
 * "Buy again" (Phase 12, decision #3): stays on the order page and reports
 * inline — `role="status"` for what landed in the cart, `role="alert"` for a
 * total miss. Partial availability is spelled out item-by-item, never silent.
 */
export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function handleReorder() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await reorderOrder(orderId);
      if (result.success) {
        const skippedText =
          result.skipped.length > 0
            ? ` — ${result.skipped.length} unavailable (${result.skipped.join(", ")})`
            : "";
        setSummary(`Added ${result.added} item${result.added === 1 ? "" : "s"} to your cart${skippedText}`);
        router.refresh(); // cart badge / layout
      } else {
        const skippedText =
          result.skipped.length > 0 ? ` (${result.skipped.join(", ")})` : "";
        setError(`${result.error}${skippedText}`);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={handleReorder}
        disabled={isPending}
        className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Buy again"}
      </button>
      {summary && (
        <span role="status" className="font-body text-small text-success mt-1 max-w-[420px]">
          {summary}
        </span>
      )}
      {error && (
        <span role="alert" className="font-body text-small text-error mt-1 max-w-[420px]">
          {error}
        </span>
      )}
    </span>
  );
}
