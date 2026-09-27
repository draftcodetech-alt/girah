import Link from "next/link";
import { getAdminOrders } from "@/modules/admin";
import { AdminOrderRow } from "@/components/admin/AdminOrderRow";

const STATUS_TABS = [
  { label: "All", status: undefined },
  { label: "Pending", status: "PENDING" },
  { label: "Confirmed", status: "CONFIRMED" },
  { label: "Processing", status: "PROCESSING" },
  { label: "Shipped", status: "SHIPPED" },
  { label: "Delivered", status: "DELIVERED" },
  { label: "Cancelled", status: "CANCELLED" },
] as const;

// Phase 13: status tabs + search (both query-param driven, both preserving
// each other) — the /admin/reviews tabs pattern combined with the
// /admin/customers GET search form.
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const known = STATUS_TABS.some((tab) => tab.status === params.status);
  const activeStatus = known ? params.status : undefined;
  const search = params.search?.trim() || undefined;
  const orders = await getAdminOrders({ status: activeStatus, search });

  const tabHref = (status?: string) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (search) query.set("search", search);
    const qs = query.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-6">Orders</h1>

      <form method="GET" className="mb-4">
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Search order #, customer name or email..."
          className="w-full max-w-[440px] h-12 rounded-[var(--radius-control)] border border-border px-4 font-body text-body bg-cream"
        />
      </form>

      <nav aria-label="Filter orders" className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.status === activeStatus;
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.status)}
              aria-current={isActive ? "page" : undefined}
              className={`h-9 px-4 inline-flex items-center rounded-[var(--radius-control)] font-body text-small font-semibold border transition-colors ${
                isActive ? "bg-sage text-cream border-sage" : "border-border text-charcoal hover:border-sage"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <p className="font-body text-body text-muted py-8">
          {search ? `No orders match “${search}”.` : "No orders here yet."}
        </p>
      ) : (
        <div>
          {orders.map((order) => (
            <AdminOrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
