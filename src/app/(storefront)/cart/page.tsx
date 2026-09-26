import Image from "next/image";
import Link from "next/link";
import { getCart } from "@/modules/cart";
import { CartLineControls } from "@/components/storefront/CartLineControls";
import { formatPrice } from "@/lib/format";

export default async function CartPage() {
  const cart = await getCart();

  if (cart.items.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-h2 text-charcoal">
          Your cart is empty
        </h1>
        <p className="font-body text-body text-muted mt-4">
          Find something handmade to cherish.
        </p>
        <Link
          href="/shop"
          className="inline-block mt-8 h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
        >
          Shop Handmade
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-12 mt-8 items-start">
        <div className="flex-1 w-full divide-y divide-border">
          {cart.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-6">
                <div className="relative w-[120px] aspect-4/5 shrink-0 rounded-[var(--radius-control)] overflow-hidden bg-sage-light">
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="120px" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-body text-card-title text-charcoal">
                    {item.productName}
                    {/* Phase 5 disabled-line UX — visible before checkout, not as a surprise failure there */}
                    {!item.isEnabled && (
                      <span className="ml-2 inline-block align-middle font-body text-label font-semibold tracking-[0.05em] uppercase text-error bg-error/10 px-2 py-0.5 rounded-[var(--radius-control)]">
                        Unavailable
                      </span>
                    )}
                  </h3>
                  <p className="font-body text-small text-muted mt-1">{item.variationName}</p>
                  <p className="font-body text-body text-sage mt-2">{formatPrice(item.unitPrice)}</p>

                  <CartLineControls
                    cartItemId={item.id}
                    productName={item.productName}
                    quantity={item.quantity}
                    availableStock={item.availableStock}
                    isEnabled={item.isEnabled}
                  />
                </div>
                <p className="font-body text-body font-medium text-charcoal">{formatPrice(item.subtotal)}</p>
              </div>
            ))}
        </div>

        <div className="w-full lg:w-[360px] shrink-0 bg-sage-light rounded-[var(--radius-surface)] p-6 lg:sticky lg:top-24">
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
            Order Summary
          </h2>
          <div className="flex justify-between font-body text-body text-charcoal mt-4">
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

          <Link
            href="/checkout"
            className="block w-full h-12 mt-6 leading-[48px] text-center rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
