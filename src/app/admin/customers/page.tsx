import Link from "next/link";
import { getAdminCustomers } from "@/modules/admin";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const customers = await getAdminCustomers(search);

  return (
    <div>
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            AUDIENCE · {customers.length} SHOWN
          </p>
          <h1 className="ax-title">
            Customers<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">Every account that can place an order, with its order count.</p>
        </div>
      </div>

      <section className="ax-panel ax-panel--body">
        <form method="GET" className="mb-6">
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search customers..."
            aria-label="Search customers"
            className="ax-input w-full max-w-[400px]"
          />
        </form>

        <div className="ax-rows">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className="flex items-center justify-between py-4 hover:bg-sage-light/30 -mx-4 px-4"
            >
              <div>
                <p className="ax-row-name">
                  {c.name} {!c.isActive && <span className="text-error text-small">(Disabled)</span>}
                </p>
                <p className="ax-row-meta">{c.email}</p>
              </div>
              <p className="ax-row-meta">{c._count.orders} order(s)</p>
            </Link>
          ))}
          {customers.length === 0 && (
            <p className="ax-sub py-8">No customers found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
