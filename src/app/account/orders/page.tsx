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
        <p className="ax-eyebrow justify-center">
          <span className="ax-eyebrow-line" aria-hidden="true" />
          YOUR ORDERS
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase">
          Orders
        </h1>
        <p className="ax-sub">You haven&apos;t placed any orders yet.</p>
        <Link href="/shop" className="ax-btn ax-btn--primary mt-8">
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
      <header className="mb-8">
        <p className="ax-eyebrow">
          <span className="ax-eyebrow-line" aria-hidden="true" />
          {orders.length} {orders.length === 1 ? "ORDER" : "ORDERS"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase">
          Orders
        </h1>
      </header>

      <section className="ax-panel ax-panel--body">
        <div className="ax-rows">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 -mx-4 px-4 hover:bg-sage-light/30"
            >
              <div>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="ax-row-name hover:text-sage underline-offset-2 hover:underline"
                >
                  #{order.orderNumber}
                </Link>
                <p className="ax-row-meta">{order.items.length} item(s)</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Received products → prompt the review loop (detail page has the per-item links). */}
                {order.orderStatus === "DELIVERED" && (
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="ax-btn ax-btn--primary h-9 px-4"
                  >
                    Review now
                  </Link>
                )}
                <div className="text-right">
                  <p className="ax-row-name">{formatPrice(order.total)}</p>
                  <p className="ax-row-meta">{order.orderStatus}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
