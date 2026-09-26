"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct, createCategory } from "@/modules/admin";

type Category = { id: string; name: string };
type ExistingProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
};

const NEW_CATEGORY_VALUE = "__new";

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
  const [categoryId, setCategoryId] = useState(existingProduct?.categoryId ?? "");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});

    if (categoryId === NEW_CATEGORY_VALUE) {
      setError("Create the new category first — then save the product.");
      return;
    }

    const input = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      description: formData.get("description") as string,
      categoryId,
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

  function handleCreateCategory() {
    setNewCategoryError(null);
    const name = newCategoryName.trim();
    const slug = newCategorySlug.trim();
    if (!name || !slug) {
      setNewCategoryError("Both name and slug are required.");
      return;
    }
    startTransition(async () => {
      const result = await createCategory({ name, slug });
      if (result.success && result.id) {
        setCategoryId(result.id);
        setNewCategoryName("");
        setNewCategorySlug("");
        setShowNewCategory(false);
        router.refresh();
      } else {
        setNewCategoryError(result.success ? "Category created — reload to select it." : result.error);
      }
    });
  }

  const inputClass = (field: string) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      fieldErrors[field] ? "border-error" : "border-border"
    }`;

  const smallInputClass = (hasError: boolean) =>
    `h-10 rounded-[var(--radius-control)] border px-3 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      hasError ? "border-error" : "border-border"
    }`;

  return (
    <form onSubmit={handleSubmit} className="max-w-[640px] space-y-4">
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Name</label>
        <input name="name" defaultValue={existingProduct?.name} required className={inputClass("name")} />
        {fieldErrors.name && <p role="alert" className="text-small text-error mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Slug</label>
        <input name="slug" defaultValue={existingProduct?.slug} required className={inputClass("slug")} />
        {fieldErrors.slug && <p role="alert" className="text-small text-error mt-1">{fieldErrors.slug}</p>}
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
        {fieldErrors.description && <p role="alert" className="text-small text-error mt-1">{fieldErrors.description}</p>}
      </div>
      <div>
        <label className="font-body text-small text-charcoal block mb-1.5">Category</label>
        <select
          name="categoryId"
          value={categoryId}
          onChange={(event) => {
            const value = event.target.value;
            setCategoryId(value);
            if (value === NEW_CATEGORY_VALUE) setShowNewCategory(true);
          }}
          required
          className={inputClass("categoryId")}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>＋ New category…</option>
        </select>
        {fieldErrors.categoryId && <p role="alert" className="text-small text-error mt-1">{fieldErrors.categoryId}</p>}

        {showNewCategory && (
          <div className="mt-3 flex flex-wrap items-end gap-3 bg-sage-light p-4 rounded-[var(--radius-control)]">
            <div>
              <label className="font-body text-small text-charcoal block mb-1">New category name</label>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className={`${smallInputClass(false)} w-44`}
                placeholder="e.g. Keychains"
              />
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1">Slug</label>
              <input
                value={newCategorySlug}
                onChange={(event) => setNewCategorySlug(event.target.value)}
                className={`${smallInputClass(false)} w-44`}
                placeholder="e.g. keychains"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={isPending}
              className="h-10 px-4 rounded-[var(--radius-control)] bg-sage text-cream font-body text-small font-semibold disabled:opacity-60"
            >
              {isPending ? "Creating…" : "Create category"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewCategory(false);
                setNewCategoryError(null);
                setCategoryId("");
              }}
              disabled={isPending}
              className="h-10 px-2 font-body text-small text-muted"
            >
              Cancel
            </button>
            {newCategoryError && (
              <p role="alert" className="w-full font-body text-small text-error">
                {newCategoryError}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="font-body text-small text-error">{error}</p>}

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
