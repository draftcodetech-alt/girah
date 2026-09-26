"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { uploadProductImage, deleteProductImage, moveProductImage } from "@/modules/admin";
import { isOptimizableImageUrl } from "@/lib/image";

type ManagedImage = { id: string; url: string; sortOrder: number };

export function ImageManager({
  productId,
  images,
}: {
  productId: string;
  images: ManagedImage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await uploadProductImage(formData);
      if (result.success) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(imageId: string) {
    setError(null);
    setConfirmId(null);
    startTransition(async () => {
      const result = await deleteProductImage(imageId);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function handleMove(imageId: string, position: "first" | "last") {
    setError(null);
    startTransition(async () => {
      const result = await moveProductImage(imageId, position);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <form ref={formRef} onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="productId" value={productId} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          required
          className="font-body text-small text-charcoal file:mr-4 file:h-10 file:rounded-[var(--radius-control)] file:border-0 file:bg-sage-light file:px-4 file:font-body file:text-small file:font-semibold file:text-charcoal"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-4 rounded-[var(--radius-control)] bg-sage text-cream font-body text-small font-semibold disabled:opacity-60"
        >
          {isPending ? "Uploading…" : "Upload image"}
        </button>
        <span className="font-body text-small text-muted">JPEG, PNG, WebP, AVIF or GIF · max 3.5 MB</span>
      </form>

      {error && (
        <p role="alert" className="font-body text-small text-error mt-3">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="font-body text-body text-muted mt-4">
          No images yet — the first upload becomes the shop-card cover.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((image, index) => (
            <li key={image.id} className="border border-border rounded-[var(--radius-surface)] p-3 bg-cream">
              {isOptimizableImageUrl(image.url) ? (
                <Image
                  src={image.url}
                  alt={`Product image ${index + 1}`}
                  width={160}
                  height={160}
                  className="w-full h-32 object-cover rounded-[var(--radius-control)] bg-sage-light"
                />
              ) : (
                <div className="w-full h-32 rounded-[var(--radius-control)] bg-sage-light flex items-center justify-center font-body text-small text-muted">
                  Image
                </div>
              )}
              <p className="font-body text-small text-muted mt-2">
                {index === 0 ? "Cover image" : `Position ${index + 1}`}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleMove(image.id, "first")}
                  disabled={isPending || index === 0}
                  className="font-body text-small text-sage font-medium disabled:opacity-50"
                >
                  Move first
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(image.id, "last")}
                  disabled={isPending || index === sorted.length - 1}
                  className="font-body text-small text-sage font-medium disabled:opacity-50"
                >
                  Move last
                </button>
                {confirmId === image.id ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(image.id)}
                    disabled={isPending}
                    className="font-body text-small text-error font-semibold underline"
                  >
                    Yes, delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(image.id)}
                    disabled={isPending}
                    className="font-body text-small text-error font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
