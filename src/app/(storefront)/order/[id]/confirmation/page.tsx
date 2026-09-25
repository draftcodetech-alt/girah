import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, getConfirmationView, startSafepayRetry } from "@/modules/orders";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

function paymentLabel(paymentMethod: string, paymentStatus: string): string {
  const status =
    paymentStatus === "PAID"
      ? "Paid"
      : paymentStatus === "REFUNDED"
        ? "Refunded"
        : paymentStatus === "FAILED"
          ? "Failed"
          : "Awaiting payment";
  return paymentMethod === "COD" ? `Cash on Delivery — ${status}` : `Online Payment — ${status}`;
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string; payment_error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderById(id);
  if (!order) notFound();

  const view = getConfirmationView(order, {
    cancelled: sp.cancelled === "1",
    paymentError: sp.payment_error === "1",
  });

  const glyph = view.cancelled ? "✕" : view.showRetry ? "!" : "✓";

  return (
    <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
      <p className="text-h3">{glyph}</p>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mt-4">
        {view.heading}
      </h1>
      <p className="font-body text-body text-muted mt-4">{view.message}</p>

      {view.abortedAtPayment && (
        <p className="font-body text-small text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-surface)] px-4 py-3 mt-6 text-left">
          You cancelled at the payment step — your order is saved and reserved. You can complete
          the payment below whenever you&apos;re ready.
        </p>
      )}
      {view.paymentError && (
        <p className="font-body text-small text-red-700 bg-red-50 border border-red-200 rounded-[var(--radius-surface)] px-4 py-3 mt-6 text-left">
          We couldn&apos;t start the payment — please try again.
        </p>
      )}

      <p className="font-body text-small font-semibold text-sage mt-6 tracking-wide">
        #{order.orderNumber}
      </p>
      <p className="font-body text-card-title text-charcoal mt-1">{formatPrice(order.total)}</p>

      <div className="bg-sage-light rounded-[var(--radius-surface)] p-6 mt-8 text-left">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-charcoal mb-4">
          Your Items
        </h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between font-body text-small py-1.5">
            <span className="text-charcoal">
              {item.productName} — {item.variationName} × {item.quantity}
            </span>
            <span className="text-charcoal">{formatPrice(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <p className="font-body text-body text-charcoal mt-6">
        {paymentLabel(order.paymentMethod, order.paymentStatus)}
      </p>

      {view.showRetry && (
        <form action={startSafepayRetry.bind(null, order.id)} className="mt-6">
          <button
            type="submit"
            className="inline-block h-12 px-8 rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
          >
            Pay Now
          </button>
        </form>
      )}

      <Link
        href="/shop"
        className="inline-block mt-8 h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
