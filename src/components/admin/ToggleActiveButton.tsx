"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCustomerActive } from "@/modules/admin/customers";

export function ToggleActiveButton({ customerId, isActive }: { customerId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await toggleCustomerActive(customerId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`h-10 px-4 rounded-[var(--radius-control)] font-body text-small font-semibold ${
          isActive ? "bg-sage-light text-charcoal" : "bg-error text-cream"
        }`}
      >
        {isPending ? "..." : isActive ? "Disable Account" : "Enable Account"}
      </button>
      {error && <p role="alert" className="font-body text-small text-error">{error}</p>}
    </div>
  );
}
