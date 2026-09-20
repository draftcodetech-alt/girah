"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "@/modules/checkout/actions";
import type { CartView } from "@/modules/cart";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

export function CheckoutForm({ cart }: { cart: CartView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "SAFEPAY">("COD");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await placeOrder({
        fullName: formData.get("fullName") as string,
        phone: formData.get("phone") as string,
        email: formData.get("email") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        postalCode: (formData.get("postalCode") as string) || "",
        deliveryNotes: (formData.get("deliveryNotes") as string) || "",
        paymentMethod,
      });

      if (result.success) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl; // leaving our site to pay
        } else {
          router.push(`/order/${result.orderId}/confirmation`);
        }
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.error) {
          setError(result.error);
        }
      }
    });
  }

  const inputClass = (field: string) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      fieldErrors[field] ? "border-error" : "border-border"
    } bg-cream`;

  return (
    <form action={handleSubmit} className="flex flex-col lg:flex-row gap-12">
      <div className="flex-1 space-y-6">
        <div>
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-4">
            Customer Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Full Name *</label>
              <input name="fullName" required className={inputClass("fullName")} />
              {fieldErrors.fullName && <p className="text-small text-error mt-1">{fieldErrors.fullName}</p>}
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Phone Number *</label>
              <input name="phone" required className={inputClass("phone")} />
              {fieldErrors.phone && <p className="text-small text-error mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Email *</label>
              <input name="email" type="email" required className={inputClass("email")} />
              {fieldErrors.email && <p className="text-small text-error mt-1">{fieldErrors.email}</p>}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-4">
            Delivery Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Address *</label>
              <input name="address" required className={inputClass("address")} />
              {fieldErrors.address && <p className="text-small text-error mt-1">{fieldErrors.address}</p>}
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">City *</label>
              <input name="city" required className={inputClass("city")} />
              {fieldErrors.city && <p className="text-small text-error mt-1">{fieldErrors.city}</p>}
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Postal Code</label>
              <input name="postalCode" className={inputClass("postalCode")} />
            </div>
            <div>
              <label className="font-body text-small text-charcoal block mb-1.5">Delivery Notes</label>
              <textarea name="deliveryNotes" rows={3} className={`${inputClass("deliveryNotes")} h-auto py-3`} />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[360px] shrink-0 bg-sage-light rounded-[var(--radius-surface)] p-6 h-fit">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Your Order
        </h2>
        <div className="space-y-3 divide-y divide-border">
          {cart.items.map((item) => (
            <div key={item.id} className="pt-3 first:pt-0 flex justify-between font-body text-small">
              <span className="text-charcoal">
                {item.productName} — {item.variationName} × {item.quantity}
              </span>
              <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between font-body text-body text-charcoal mt-4 pt-4 border-t border-border">
          <span>Subtotal</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
        <div className="flex justify-between font-body text-body text-muted mt-2">
          <span>Shipping</span>
          <span>FREE</span>
        </div>
        <div className="flex justify-between font-body text-card-title font-semibold text-charcoal mt-4 pt-4 border-t border-border">
          <span>Total</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>

        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mt-6 mb-3">
          Payment
        </h2>
        <label className={`flex items-center gap-2 h-12 px-4 rounded-[var(--radius-control)] border-2 font-body text-body text-charcoal cursor-pointer ${paymentMethod === "COD" ? "border-sage bg-cream" : "border-border bg-cream"}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="COD"
            checked={paymentMethod === "COD"}
            onChange={() => setPaymentMethod("COD")}
            className="accent-sage"
          />
          Cash on Delivery
        </label>
        <label className={`flex items-center gap-2 h-12 px-4 rounded-[var(--radius-control)] border-2 font-body text-body text-charcoal cursor-pointer mt-2 ${paymentMethod === "SAFEPAY" ? "border-sage bg-cream" : "border-border bg-cream"}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="SAFEPAY"
            checked={paymentMethod === "SAFEPAY"}
            onChange={() => setPaymentMethod("SAFEPAY")}
            className="accent-sage"
          />
          Online Payment (Cards, JazzCash, EasyPaisa)
        </label>

        {error && <p className="font-body text-small text-error mt-4">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-12 mt-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
        >
          {isPending ? "Processing your order…" : "Place Order"}
        </button>
      </div>
    </form>
  );
}