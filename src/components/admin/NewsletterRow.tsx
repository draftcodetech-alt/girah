"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNewsletterSubscriber } from "@/modules/newsletter";

export function NewsletterRow({ id, email, date }: { id: string; email: string; date: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [gone, setGone] = useState(false);

  function handleDelete() {
    setConfirming(false);
    startTransition(async () => {
      const result = await deleteNewsletterSubscriber(id);
      if (result.success) {
        setGone(true);
        router.refresh();
      }
    });
  }

  if (gone) return null;

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-body text-body text-charcoal truncate">{email}</p>
        <p className="font-body text-small text-muted">{date}</p>
      </div>
      {confirming ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="font-body text-small text-error font-semibold underline shrink-0"
        >
          {isPending ? "Removing…" : "Yes, remove"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="font-body text-small text-error font-medium shrink-0"
        >
          Remove
        </button>
      )}
    </li>
  );
}
