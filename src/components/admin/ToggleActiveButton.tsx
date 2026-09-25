"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCustomerActive } from "@/modules/admin/customers";

export function ToggleActiveButton({ customerId, isActive }: { customerId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleCustomerActive(customerId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`h-10 px-4 rounded-[var(--radius-control)] font-body text-small font-semibold ${
        isActive ? "bg-sage-light text-charcoal" : "bg-error text-cream"
      }`}
    >
      {isPending ? "..." : isActive ? "Disable Account" : "Enable Account"}
    </button>
  );
}
