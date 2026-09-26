"use client";

import { useActionState } from "react";
import { updateCartItemQuantity, removeCartItem } from "@/modules/cart/actions";

type CartLineControlsProps = {
  cartItemId: string;
  productName: string;
  quantity: number;
  availableStock: number;
  isEnabled: boolean;
};

type ControlState = string | null;

// Phase 8: these three forms used to be inline server-component closures whose
// `CartActionResult` was awaited and discarded — a refused change (stock moved
// while the page was open, line disabled) left the number unchanged with no
// message. One form action now surfaces the refusal as a `role="alert"` line.
// The forms carry only hidden inputs, so React 19's auto-reset on submit is a
// no-op (the Phase 6 concern applies to forms with user-entered values).
export function CartLineControls({
  cartItemId,
  productName,
  quantity,
  availableStock,
  isEnabled,
}: CartLineControlsProps) {
  const [error, formAction] = useActionState<ControlState, FormData>(
    async (_prev, formData) => {
      const op = String(formData.get("op") ?? "");
      const baseQuantity = Number(formData.get("q"));
      const result =
        op === "remove"
          ? await removeCartItem(cartItemId)
          : await updateCartItemQuantity(
              cartItemId,
              op === "dec" ? baseQuantity - 1 : baseQuantity + 1
            );
      if (result.success) return null;
      return result.error ?? "Something went wrong updating your cart. Please try again.";
    },
    null
  );

  return (
    <>
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center h-12 w-[144px] rounded-[var(--radius-control)] border border-border">
          <form action={formAction}>
            <input type="hidden" name="op" value="dec" />
            <input type="hidden" name="q" value={quantity} />
            <button
              type="submit"
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || !isEnabled || availableStock <= 0}
              className="flex-1 h-12 w-12 disabled:text-placeholder text-charcoal"
            >
              −
            </button>
          </form>
          <span className="font-body text-body px-3 flex-1 text-center">{quantity}</span>
          <form action={formAction}>
            <input type="hidden" name="op" value="inc" />
            <input type="hidden" name="q" value={quantity} />
            <button
              type="submit"
              aria-label="Increase quantity"
              disabled={quantity >= availableStock || !isEnabled || availableStock <= 0}
              className="flex-1 h-12 w-12 disabled:text-placeholder text-charcoal"
            >
              +
            </button>
          </form>
        </div>
        <form action={formAction}>
          <input type="hidden" name="op" value="remove" />
          <input type="hidden" name="q" value={quantity} />
          <button
            type="submit"
            aria-label={`Remove ${productName}`}
            className="text-muted hover:text-error font-body text-small"
          >
            Remove
          </button>
        </form>
      </div>
      {error && <p role="alert" className="font-body text-small text-error mt-2">{error}</p>}
    </>
  );
}
