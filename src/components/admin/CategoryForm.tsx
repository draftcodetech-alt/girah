"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/modules/admin";

type ExistingCategory = { id: string; name: string; slug: string };

export function CategoryForm({
  existing,
  onSaved,
}: {
  existing?: ExistingCategory;
  onSaved?: (id?: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
    };
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = existing
        ? await updateCategory(existing.id, input)
        : await createCategory(input);

      if (result.success) {
        router.refresh();
        onSaved?.("id" in result && typeof result.id === "string" ? result.id : undefined);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const inputClass = (field: string) =>
    `ax-input w-48${fieldErrors[field] ? " ax-input--error" : ""}`;

  // This form renders once per row in edit mode — prefix ids so simultaneous
  // editors never share an id.
  const idPrefix = existing?.id ?? "new-category";

  return (
    <form onSubmit={handleSubmit} className="ax-form-grid">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="ax-form-label">Name</label>
        <input id={`${idPrefix}-name`} name="name" defaultValue={existing?.name} required className={inputClass("name")} />
        {fieldErrors.name && <p role="alert" className="ax-form-error">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-slug`} className="ax-form-label">Slug</label>
        <input id={`${idPrefix}-slug`} name="slug" defaultValue={existing?.slug} required className={inputClass("slug")} />
        {fieldErrors.slug && <p role="alert" className="ax-form-error">{fieldErrors.slug}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="ax-btn ax-btn--primary disabled:opacity-60"
      >
        {isPending ? "Saving…" : existing ? "Save category" : "Add category"}
      </button>
      {error && <p role="alert" className="w-full ax-form-note">{error}</p>}
    </form>
  );
}
