import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminOrderById } from "@/modules/admin";
import { OrderActions } from "@/components/admin/OrderActions";
import { formatPrice, formatDate } from "@/lib/format";

// Phase 13: full order detail — the row-level controls plus everything the
// list drops (line items, customer, delivery block, payment reference).
// Visual pass: same sections and data, cream panels + serif headings.
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
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            ORDER · PLACED {formatDate(order.createdAt)}
          </p>
          <h1 className="ax-title">
            #{order.orderNumber}
            <span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">
            {order.orderStatus} · {order.paymentMethod} · {order.paymentStatus}
          </p>
        </div>
        <Link href="/admin/orders" className="ax-btn ax-btn--ghost">
          ← Back to orders
        </Link>
      </div>

      <div className="mb-6">
        <OrderActions order={order} />
      </div>

      <section className="ax-panel ax-panel--body">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">Customer</p>
            <h2>Who ordered</h2>
          </div>
        </div>
        <p className="ax-row-name">{order.customerName}</p>
        <p className="ax-row-meta">{order.customerEmail}</p>
        <p className="ax-row-meta">{order.customerPhone}</p>
        {order.user && (
          <Link
            href={`/admin/customers/${order.user.id}`}
            className="ax-text-link mt-3 inline-flex"
          >
            View customer account
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
            </svg>
          </Link>
        )}
      </section>

      <section className="ax-panel ax-panel--body mt-6">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">Delivery</p>
            <h2>Where it goes</h2>
          </div>
        </div>
        <p className="ax-row-name">
          {order.shippingAddress}, {order.shippingCity}
          {order.shippingPostal ? ` ${order.shippingPostal}` : ""}
        </p>
        {order.deliveryNotes && <p className="ax-row-meta">Note: {order.deliveryNotes}</p>}
      </section>

      <section className="ax-panel ax-panel--body mt-6">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">Items</p>
            <h2>What&apos;s in it</h2>
          </div>
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1.5 text-[12.5px]">
            <span className="text-charcoal">
              {item.productName} — {item.variationName} × {item.quantity}
            </span>
            <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex justify-between text-[12.5px] text-muted">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[12.5px] text-muted">
            <span>Shipping</span>
            <span>{order.shipping === 0 ? "FREE" : formatPrice(order.shipping)}</span>
          </div>
          <div className="flex justify-between text-[14px] font-semibold text-charcoal pt-2 border-t border-border">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      <section className="ax-panel ax-panel--body mt-6">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">Payment</p>
            <h2>How it was paid</h2>
          </div>
        </div>
        <p className="ax-row-name">
          {order.paymentMethod} — {order.paymentStatus}
        </p>
        {order.safepayTracker && (
          <p className="ax-row-meta break-all">Safepay tracker: {order.safepayTracker}</p>
        )}
      </section>
    </div>
  );
}
