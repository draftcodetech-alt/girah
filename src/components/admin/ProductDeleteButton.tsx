"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/modules/admin";

/**
 * Two-step confirm (Delete → Yes, delete): deletes are irreversible for the
 * storefront, and the friendly "referenced by orders or carts" refusal from
 * `deleteProduct` is surfaced inline instead of a toast.
 */
export function ProductDeleteButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      {confirming ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="ax-inline-btn ax-inline-btn--danger ax-inline-btn--confirm"
        >
          {isPending ? "Deleting…" : `Yes, delete “${productName}”`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="ax-inline-btn ax-inline-btn--danger"
        >
          Delete
        </button>
      )}
      {error && (
        <span role="alert" className="ax-row-error max-w-[240px] text-right">
          {error}
        </span>
      )}
    </span>
  );
}
