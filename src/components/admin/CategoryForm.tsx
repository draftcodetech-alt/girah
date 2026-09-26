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
    `h-10 rounded-[var(--radius-control)] border px-3 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      fieldErrors[field] ? "border-error" : "border-border"
    }`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="font-body text-small text-charcoal block mb-1">Name</label>
        <input name="name" defaultValue={existing?.name} required className={`${inputClass("name")} w-48`} />
        {fieldErrors.name && <p role="alert" className="text-small text-error mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1">Slug</label>
        <input name="slug" defaultValue={existing?.slug} required className={`${inputClass("slug")} w-48`} />
        {fieldErrors.slug && <p role="alert" className="text-small text-error mt-1">{fieldErrors.slug}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 px-4 rounded-[var(--radius-control)] bg-sage text-cream font-body text-small font-semibold disabled:opacity-60"
      >
        {isPending ? "Saving…" : existing ? "Save category" : "Add category"}
      </button>
      {error && <p role="alert" className="w-full font-body text-small text-error">{error}</p>}
    </form>
  );
}
