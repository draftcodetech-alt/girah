/**
 * Storefront announcement bar — static, server-rendered, zero client JS.
 * Every claim is a live store fact (Order.shipping @default(0); COD is a
 * first-class payment method), never marketing copy that can rot.
 */
export function AnnouncementBar() {
  return (
    <p className="bg-sage px-4 py-2 text-center font-body text-small text-cream tracking-[0.04em]">
      Free shipping on all orders · Cash on delivery available
    </p>
  );
}
