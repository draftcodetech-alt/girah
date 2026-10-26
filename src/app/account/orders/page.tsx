import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyOrders } from "@/modules/orders";
import { formatPrice } from "@/lib/format";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function OrdersPage() {
  // Phase 4 L5: inline guard (proxy.ts is defense-in-depth, not the only
  // line of defense) — getMyOrders must never run without a real session.
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const orders = await getMyOrders();

  if (orders.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Orders" }]}
        />
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal uppercase">Orders</h1>
        <p className="font-body text-body text-muted mt-4">You haven&apos;t placed any orders yet.</p>
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
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Orders" }]}
      />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal uppercase mb-8">Orders</h1>
      <div className="divide-y divide-border">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4 -mx-4 px-4 hover:bg-sage-light/30"
          >
            <div>
              <Link
                href={`/account/orders/${order.id}`}
                className="font-body text-body font-medium text-charcoal hover:text-sage underline-offset-2 hover:underline"
              >
                #{order.orderNumber}
              </Link>
              <p className="font-body text-small text-muted mt-1">{order.items.length} item(s)</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Received products → prompt the review loop (detail page has the per-item links). */}
              {order.orderStatus === "DELIVERED" && (
                <Link
                  href={`/account/orders/${order.id}`}
                  className="h-10 px-5 inline-flex items-center rounded-[var(--radius-control)] font-body text-small font-semibold bg-sage text-cream"
                >
                  Review now
                </Link>
              )}
              <div className="text-right">
                <p className="font-body text-body text-charcoal">{formatPrice(order.total)}</p>
                <p className="font-body text-small text-sage mt-1">{order.orderStatus}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
