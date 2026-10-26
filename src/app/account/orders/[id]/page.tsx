import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyOrderById } from "@/modules/orders";
import { formatPrice, formatDate } from "@/lib/format";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getMyOrderById(id); // IDOR-protected — returns null if this isn't YOUR order
  if (!order) notFound();

  return (
    <div className="max-w-[700px] mx-auto px-4 py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Orders", href: "/account/orders" },
          { label: `Order #${order.orderNumber}` },
        ]}
      />
      <header className="mb-8">
        <p className="ax-eyebrow">
          <span className="ax-eyebrow-line" aria-hidden="true" />
          PLACED {formatDate(order.createdAt)}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase">
          Order #{order.orderNumber}
        </h1>
      </header>

      <section className="ax-panel ax-panel--body">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">ITEMS</p>
            <h2>What you ordered</h2>
          </div>
          <span className="ax-pill">
            <i aria-hidden="true" />
            {order.orderStatus}
          </span>
        </div>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-start gap-4 py-1.5 text-[13px]">
            <span className="text-charcoal">
              {item.productName} — {item.variationName} × {item.quantity}
            </span>
            <span className="flex items-center gap-4 shrink-0">
              {/* Received order → deep link into the product's review form. */}
              {order.orderStatus === "DELIVERED" && item.productSlug && (
                <Link
                  href={`/product/${item.productSlug}#reviews-heading`}
                  className="text-sage font-semibold underline underline-offset-2 hover:text-charcoal"
                >
                  Review now
                </Link>
              )}
              <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
            </span>
          </div>
        ))}
        <div className="flex justify-between text-[15px] font-semibold text-charcoal mt-4 pt-4 border-t border-border">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </section>

      <section className="ax-panel ax-panel--body mt-6">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">SHIPPING</p>
            <h2>Where it went</h2>
          </div>
        </div>
        <p className="ax-row-name">
          {order.shippingAddress}, {order.shippingCity}
        </p>
      </section>

      <section className="ax-panel ax-panel--body mt-6">
        <div className="ax-section-label">
          <div>
            <p className="ax-kicker">STATUS</p>
            <h2>How it went</h2>
          </div>
        </div>
        <p className="ax-row-meta">
          Order: {order.orderStatus} — Payment: {order.paymentStatus}
        </p>
      </section>

      {/* Action bar: receipt always (cancel / buy-again were removed as
          spec'd; the review prompt lives on each delivered line item). */}
      <div className="flex flex-wrap items-start gap-4 mt-8">
        <Link href={`/account/orders/${order.id}/receipt`} className="ax-btn ax-btn--ghost">
          View receipt
        </Link>
      </div>
    </div>
  );
}
