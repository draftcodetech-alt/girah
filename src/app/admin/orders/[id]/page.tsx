import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminOrderById } from "@/modules/admin";
import { OrderActions } from "@/components/admin/OrderActions";
import { formatPrice, formatDate } from "@/lib/format";

// Phase 13: full order detail — the row-level controls plus everything the
// list drops (line items, customer, delivery block, payment reference).
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getAdminOrderById(id);
  if (!order) notFound();

  return (
    <div className="max-w-[900px]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">
          Order #{order.orderNumber}
        </h1>
        <Link
          href="/admin/orders"
          className="font-body text-small text-sage underline self-start mt-3"
        >
          Back to orders
        </Link>
      </div>
      <p className="font-body text-small text-muted">
        Placed {formatDate(order.createdAt)} · {order.orderStatus}
      </p>

      <div className="mt-6">
        <OrderActions order={order} allowRefund />
      </div>

      <section className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Customer
        </h2>
        <p className="font-body text-body text-charcoal">{order.customerName}</p>
        <p className="font-body text-small text-charcoal">{order.customerEmail}</p>
        <p className="font-body text-small text-charcoal">{order.customerPhone}</p>
        {order.user && (
          <Link
            href={`/admin/customers/${order.user.id}`}
            className="inline-block mt-2 font-body text-small text-sage underline"
          >
            View customer account
          </Link>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
          Delivery
        </h2>
        <p className="font-body text-body text-charcoal">
          {order.shippingAddress}, {order.shippingCity}
          {order.shippingPostal ? ` ${order.shippingPostal}` : ""}
        </p>
        {order.deliveryNotes && (
          <p className="font-body text-small text-muted mt-1">Note: {order.deliveryNotes}</p>
        )}
      </section>

      <section className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Items
        </h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between font-body text-small py-1.5">
            <span className="text-charcoal">
              {item.productName} — {item.variationName} × {item.quantity}
            </span>
            <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex justify-between font-body text-small text-muted">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between font-body text-small text-muted">
            <span>Shipping</span>
            <span>{order.shipping === 0 ? "FREE" : formatPrice(order.shipping)}</span>
          </div>
          <div className="flex justify-between font-body text-body font-semibold text-charcoal pt-2 border-t border-border">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
          Payment
        </h2>
        <p className="font-body text-body text-charcoal">
          {order.paymentMethod} — {order.paymentStatus}
        </p>
        {order.safepayTracker && (
          <p className="font-body text-small text-muted mt-1 break-all">
            Safepay tracker: {order.safepayTracker}
          </p>
        )}
      </section>
    </div>
  );
}
