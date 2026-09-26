import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyOrderForReceipt } from "@/modules/orders";
import { formatPrice, formatDate } from "@/lib/format";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PrintButton } from "@/components/storefront/PrintButton";

// Owner-only invoice (IDOR-protected like the order detail page): the
// detail view withholds PII on purpose — the receipt is the one page that
// shows the full delivery block, for printing.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getMyOrderForReceipt(id);
  if (!order) notFound();

  return (
    <div className="max-w-[700px] mx-auto px-4 py-12">
      {/* Screen-only chrome: hidden when printing. */}
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Account", href: "/account" },
            { label: "Orders", href: "/account/orders" },
            { label: `Receipt #${order.orderNumber}` },
          ]}
        />
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">
          Receipt
        </h1>
        <div className="flex flex-wrap gap-4 mt-6">
          <PrintButton />
          <Link
            href={`/account/orders/${order.id}`}
            className="h-12 px-6 inline-flex items-center rounded-[var(--radius-control)] font-body text-button font-semibold bg-cream text-charcoal border border-border"
          >
            Back to order
          </Link>
        </div>
      </div>

      <div className="bg-cream rounded-[var(--radius-surface)] p-6 mt-8">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-[family-name:var(--font-display)] text-card-title text-charcoal">
              Girah
            </p>
            <p className="font-body text-small text-muted">Handcrafted with care</p>
          </div>
          <div className="text-right">
            <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal">
              Order #{order.orderNumber}
            </p>
            <p className="font-body text-small text-muted mt-1">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-border">
          <div>
            <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
              Billed to
            </p>
            <p className="font-body text-body text-charcoal">{order.customerName}</p>
            <p className="font-body text-small text-charcoal">{order.customerEmail}</p>
            <p className="font-body text-small text-charcoal">{order.customerPhone}</p>
          </div>
          <div>
            <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
              Ship to
            </p>
            <p className="font-body text-body text-charcoal">{order.shippingAddress}</p>
            <p className="font-body text-small text-charcoal">
              {order.shippingCity}
              {order.shippingPostal ? ` ${order.shippingPostal}` : ""}
            </p>
            {order.deliveryNotes && (
              <p className="font-body text-small text-muted mt-1">{order.deliveryNotes}</p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-3">
            Items
          </p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between font-body text-small py-1.5">
              <span className="text-charcoal">
                {item.productName} — {item.variationName} × {item.quantity}
              </span>
              <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>

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

        <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="font-body text-small text-muted">Payment method</p>
            <p className="font-body text-body text-charcoal">{order.paymentMethod}</p>
          </div>
          <div>
            <p className="font-body text-small text-muted">Payment status</p>
            <p className="font-body text-body text-charcoal">{order.paymentStatus}</p>
          </div>
          <div>
            <p className="font-body text-small text-muted">Order status</p>
            <p className="font-body text-body text-charcoal">{order.orderStatus}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
