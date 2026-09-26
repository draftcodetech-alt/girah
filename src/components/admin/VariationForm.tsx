"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createVariation, updateVariation } from "@/modules/admin";

type EditableVariation = {
  id: string;
  name: string;
  price: number; // integer paisa, straight from the DB
  isEnabled: boolean;
};

/**
 * Create mode (productId given): posts rupees — `createVariation` converts to
 * paisa server-side. Edit mode reuses the existing `updateVariation` contract,
 * which takes paisa, so THIS form does the Math.round(rupees * 100) conversion.
 * Stock is intentionally absent from edit mode: adjustStock is the only path
 * that changes stock (it writes the audit row).
 */
export function VariationForm({
  productId,
  variation,
  onDone,
}: {
  productId?: string;
  variation?: EditableVariation;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isCreate = Boolean(productId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});

    const name = String(formData.get("name") ?? "");
    const rupees = Number(formData.get("price"));
    const isEnabled = formData.get("isEnabled") === "on";

    startTransition(async () => {
      const result = isCreate
        ? await createVariation({
            productId: productId!,
            name,
            price: rupees,
            stock: Number(formData.get("stock")),
            isEnabled,
          })
        : await updateVariation(variation!.id, {
            name,
            price: Math.round(rupees * 100),
            isEnabled,
          });

      if (result.success) {
        router.refresh();
        onDone?.();
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
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3 bg-sage-light p-4 rounded-[var(--radius-control)]">
      <div>
        <label className="font-body text-small text-charcoal block mb-1">Name</label>
        <input name="name" defaultValue={variation?.name} required className={`${inputClass("name")} w-44`} />
        {fieldErrors.name && <p role="alert" className="text-small text-error mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1">Price (Rs.)</label>
        <input
          name="price"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={variation ? (variation.price / 100).toFixed(2) : undefined}
          className={`${inputClass("price")} w-32`}
        />
        {fieldErrors.price && <p role="alert" className="text-small text-error mt-1">{fieldErrors.price}</p>}
      </div>
      {isCreate && (
        <div>
          <label className="font-body text-small text-charcoal block mb-1">Stock</label>
          <input
            name="stock"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={0}
            className={`${inputClass("stock")} w-24`}
          />
          {fieldErrors.stock && <p role="alert" className="text-small text-error mt-1">{fieldErrors.stock}</p>}
        </div>
      )}
      <label className="flex items-center gap-2 font-body text-small text-charcoal h-10">
        <input type="checkbox" name="isEnabled" defaultChecked={variation?.isEnabled ?? true} />
        Enabled
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 px-4 rounded-[var(--radius-control)] bg-sage text-cream font-body text-small font-semibold disabled:opacity-60"
      >
        {isPending ? "Saving…" : isCreate ? "Add variation" : "Save changes"}
      </button>
      {!isCreate && (
        <button type="button" onClick={onDone} disabled={isPending} className="h-10 px-2 font-body text-small text-muted">
          Cancel
        </button>
      )}
      {error && <p role="alert" className="w-full font-body text-small text-error">{error}</p>}
    </form>
  );
}
