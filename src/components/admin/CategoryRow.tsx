"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/modules/admin";
import { CategoryForm } from "./CategoryForm";

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
};

export function CategoryRow({ category }: { category: AdminCategory }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="py-4 border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-body font-medium text-charcoal">{category.name}</p>
          <p className="font-body text-small text-muted mt-1">
            /{category.slug} · {category._count.products} product(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            disabled={isPending}
            className="font-body text-small text-sage font-medium"
          >
            {editing ? "Close" : "Edit"}
          </button>
          {confirming ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="font-body text-small text-error font-semibold underline"
            >
              {isPending ? "Deleting…" : "Yes, delete"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isPending}
              className="font-body text-small text-error font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <CategoryForm existing={category} onSaved={() => setEditing(false)} />
        </div>
      )}
      {error && (
        <p role="alert" className="font-body text-small text-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
