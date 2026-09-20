import { redirect } from "next/navigation";
import { getCart } from "@/modules/cart";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";

export default async function CheckoutPage() {
  const cart = await getCart();
  if (cart.items.length === 0) {
    redirect("/cart");
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">Checkout</h1>
      <div className="mt-8">
        <CheckoutForm cart={cart} />
      </div>
    </div>
  );
}
