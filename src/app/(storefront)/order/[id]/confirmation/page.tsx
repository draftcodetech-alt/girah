import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById } from "@/modules/orders";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
      <p className="text-h3">✓</p>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mt-4">
        Order Confirmed
      </h1>
      <p className="font-body text-body text-muted mt-4">
        Thank you for your order. Your handmade Girah pieces are on their way.
      </p>
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
        {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"} —{" "}
        <span className="text-muted">Payment Status: {order.paymentStatus}</span>
      </p>

      <Link
        href="/shop"
        className="inline-block mt-8 h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
