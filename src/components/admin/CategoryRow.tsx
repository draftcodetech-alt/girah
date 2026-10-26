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
    <div className="py-4">
      <div className="ax-row-head">
        <div>
          <p className="ax-row-name">{category.name}</p>
          <p className="ax-row-meta">
            /{category.slug} · {category._count.products} product(s)
          </p>
        </div>
        <div className="ax-row-actions">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            disabled={isPending}
            className="ax-inline-btn"
          >
            {editing ? "Close" : "Edit"}
          </button>
          {confirming ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="ax-inline-btn ax-inline-btn--danger ax-inline-btn--confirm"
            >
              {isPending ? "Deleting…" : "Yes, delete"}
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
        </div>
      </div>

      {editing && (
        <div className="ax-row-panel">
          <CategoryForm existing={category} onSaved={() => setEditing(false)} />
        </div>
      )}
      {error && (
        <p role="alert" className="ax-row-error">
          {error}
        </p>
      )}
    </div>
  );
}
