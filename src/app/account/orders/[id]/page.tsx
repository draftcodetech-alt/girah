import { notFound } from "next/navigation";
import { getMyOrderById } from "@/modules/orders";
import { formatPrice } from "@/lib/format";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getMyOrderById(id); // IDOR-protected — returns null if this isn't YOUR order
  if (!order) notFound();

  return (
    <div className="max-w-[700px] mx-auto px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">
        Order #{order.orderNumber}
      </h1>
      <p className="font-body text-body text-muted mt-2">
        Placed {order.createdAt.toLocaleDateString()}
      </p>

      <div className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-8">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Items
        </h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between font-body text-small py-1.5">
            <span className="text-charcoal">
              {item.productName} — {item.variationName} × {item.quantity}
            </span>
            <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
          </div>
        ))}
        <div className="flex justify-between font-body text-body font-semibold text-charcoal mt-4 pt-4 border-t border-border">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
          Shipping
        </h2>
        <p className="font-body text-body text-charcoal">
          {order.shippingAddress}, {order.shippingCity}
        </p>
      </div>

      <div className="mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
          Status
        </h2>
        <p className="font-body text-body text-charcoal">
          Order: {order.orderStatus} — Payment: {order.paymentStatus}
        </p>
      </div>
    </div>
  );
}
