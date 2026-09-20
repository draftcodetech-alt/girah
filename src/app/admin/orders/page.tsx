import { getAdminOrders } from "@/modules/admin";
import { AdminOrderRow } from "@/components/admin/AdminOrderRow";

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Orders</h1>
      <div>
        {orders.map((order) => (
          <AdminOrderRow key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
