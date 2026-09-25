import { notFound } from "next/navigation";
import { getAdminCustomerById } from "@/modules/admin";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";

function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK")}`;
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminCustomerById(id);
  if (!data) notFound();

  const { customer, orders, savedShipping } = data;

  return (
    <div className="max-w-[700px]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">{customer.name}</h1>
        <ToggleActiveButton customerId={customer.id} isActive={customer.isActive} />
      </div>
      <p className="font-body text-body text-muted">{customer.email}</p>
      {customer.phone && <p className="font-body text-body text-muted">{customer.phone}</p>}
      <p className="font-body text-small text-muted mt-2">
        Joined {customer.createdAt.toLocaleDateString()}
      </p>

      {savedShipping && (
        <div className="mt-8">
          <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-2">
            Saved Shipping
          </h2>
          <p className="font-body text-body text-charcoal">
            {savedShipping.fullName} · {savedShipping.phone}
            <br />
            {savedShipping.address}, {savedShipping.city}
          </p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-4">
          Order History
        </h2>
        <div className="divide-y divide-border">
          {orders.map((order) => (
            <div key={order.id} className="flex justify-between py-3">
              <span className="font-body text-body text-charcoal">#{order.orderNumber}</span>
              <span className="font-body text-body text-charcoal">{formatPrice(order.total)}</span>
              <span className="font-body text-small text-sage">{order.orderStatus}</span>
            </div>
          ))}
          {orders.length === 0 && <p className="font-body text-small text-muted py-3">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}
