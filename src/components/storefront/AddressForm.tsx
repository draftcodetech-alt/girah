"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveShippingAddress, deleteShippingAddress } from "@/modules/addresses";
import type { SavedShippingView } from "@/modules/addresses";

/**
 * Save/delete the customer's single saved shipping address (Phase 12).
 * Same validate-first + inline `role="alert"` / `role="status"` conventions
 * as ProfileForm; delete uses the ProductDeleteButton two-step confirm.
 */
export function AddressForm({ address }: { address: SavedShippingView | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    startTransition(async () => {
      const result = await saveShippingAddress({
        fullName: formData.get("fullName") as string,
        phone: formData.get("phone") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        postalCode: (formData.get("postalCode") as string) || "",
      });
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  function handleDelete() {
    setError(null);
    setConfirmingDelete(false);
    startDeleteTransition(async () => {
      const result = await deleteShippingAddress();
      if (!result.success) setError(result.error);
      else router.refresh(); // key-remounts this form with empty defaults
    });
  }

  const inputClass = (field: string) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      fieldErrors[field] ? "border-error" : "border-border"
    }`;

  return (
    <div className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Full Name *</label>
          <input name="fullName" required defaultValue={address?.fullName ?? ""} className={inputClass("fullName")} />
          {fieldErrors.fullName && <p role="alert" className="text-small text-error mt-1">{fieldErrors.fullName}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Phone Number *</label>
          <input name="phone" required defaultValue={address?.phone ?? ""} className={inputClass("phone")} />
          {fieldErrors.phone && <p role="alert" className="text-small text-error mt-1">{fieldErrors.phone}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Address *</label>
          <input name="address" required defaultValue={address?.address ?? ""} className={inputClass("address")} />
          {fieldErrors.address && <p role="alert" className="text-small text-error mt-1">{fieldErrors.address}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">City *</label>
          <input name="city" required defaultValue={address?.city ?? ""} className={inputClass("city")} />
          {fieldErrors.city && <p role="alert" className="text-small text-error mt-1">{fieldErrors.city}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Postal Code</label>
          <input name="postalCode" defaultValue={address?.postalCode ?? ""} className={inputClass("postalCode")} />
        </div>

        {error && <p role="alert" className="font-body text-small text-error">{error}</p>}
        {success && <p role="status" className="font-body text-small text-success">✓ Address saved</p>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={isPending || isDeleting}
            className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save Address"}
          </button>
          {address && (
            <span className="inline-flex flex-col items-end">
              {confirmingDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="font-body text-small text-error font-semibold underline"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete my saved address"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isDeleting}
                  className="font-body text-small text-error font-medium"
                >
                  Delete
                </button>
              )}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
