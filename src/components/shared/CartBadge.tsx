import Link from "next/link";
import { getCartItemCount } from "@/modules/cart";

export async function CartBadge() {
  const count = await getCartItemCount();

  return (
    <Link href="/cart" className="relative inline-flex items-center font-body text-body text-charcoal">
      Cart
      {count > 0 && (
        <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-sage text-cream text-[11px] font-semibold">
          {count}
        </span>
      )}
    </Link>
  );
}
