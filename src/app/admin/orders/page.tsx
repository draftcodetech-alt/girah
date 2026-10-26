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
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            FULFILMENT · {orders.length} SHOWN
          </p>
          <h1 className="ax-title">
            Orders<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">Filter by status, search by number, customer or email.</p>
        </div>
      </div>

      <section className="ax-panel ax-panel--body">
        <form method="GET" className="mb-4">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search order #, customer name or email..."
            aria-label="Search orders"
            className="ax-input w-full max-w-[440px]"
          />
        </form>

        <nav aria-label="Filter orders" className="ax-tabs mb-6">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.status === activeStatus;
            return (
              <Link
                key={tab.label}
                href={tabHref(tab.status)}
                aria-current={isActive ? "page" : undefined}
                className={`ax-tab${isActive ? " is-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {orders.length === 0 ? (
          <p className="ax-sub py-8">
            {search ? `No orders match “${search}”.` : "No orders here yet."}
          </p>
        ) : (
          <div className="ax-rows">
            {orders.map((order) => (
              <AdminOrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
