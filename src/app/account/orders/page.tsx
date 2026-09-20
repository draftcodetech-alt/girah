import Link from "next/link";
import { getMyOrders } from "@/modules/orders";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

export default async function OrdersPage() {
  const orders = await getMyOrders();

  if (orders.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">Orders</h1>
        <p className="font-body text-body text-muted mt-4">You haven't placed any orders yet.</p>
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
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Orders</h1>
      <div className="divide-y divide-border">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/account/orders/${order.id}`}
            className="flex items-center justify-between py-4 hover:bg-sage-light/30 -mx-4 px-4"
          >
            <div>
              <p className="font-body text-body font-medium text-charcoal">#{order.orderNumber}</p>
              <p className="font-body text-small text-muted mt-1">{order.items.length} item(s)</p>
            </div>
            <div className="text-right">
              <p className="font-body text-body text-charcoal">{formatPrice(order.total)}</p>
              <p className="font-body text-small text-sage mt-1">{order.orderStatus}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
