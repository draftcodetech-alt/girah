"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/modules/admin/products";

type Category = { id: string; name: string };
type ExistingProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
};

export function ProductForm({
  categories,
  existingProduct,
}: {
  categories: Category[];
  existingProduct?: ExistingProduct;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    const input = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      description: formData.get("description") as string,
      categoryId: formData.get("categoryId") as string,
    };

    startTransition(async () => {
      const result = existingProduct
        ? await updateProduct(existingProduct.id, input)
        : await createProduct(input);

      if (result.success) {
        router.push("/admin/products");
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const inputClass = (field: string) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      fieldErrors[field] ? "border-error" : "border-border"
    }`;

  return (
    <form action={handleSubmit} className="max-w-[640px] space-y-4">
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Name</label>
        <input name="name" defaultValue={existingProduct?.name} required className={inputClass("name")} />
        {fieldErrors.name && <p className="text-small text-error mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Slug</label>
        <input name="slug" defaultValue={existingProduct?.slug} required className={inputClass("slug")} />
        {fieldErrors.slug && <p className="text-small text-error mt-1">{fieldErrors.slug}</p>}
        <p className="font-body text-small text-muted mt-1">Lowercase, hyphens only — becomes the product URL.</p>
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Description</label>
        <textarea
          name="description"
          defaultValue={existingProduct?.description}
          required
          rows={4}
          className={`${inputClass("description")} h-auto py-3`}
        />
        {fieldErrors.description && <p className="text-small text-error mt-1">{fieldErrors.description}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Category</label>
        <select name="categoryId" defaultValue={existingProduct?.categoryId} required className={inputClass("categoryId")}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId && <p className="text-small text-error mt-1">{fieldErrors.categoryId}</p>}
      </div>

      {error && <p className="font-body text-small text-error">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
      >
        {isPending ? "Saving…" : existingProduct ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}
