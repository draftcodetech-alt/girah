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
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Customers</h1>

      <form method="GET" className="mb-6">
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Search customers..."
          className="w-full max-w-[400px] h-12 rounded-[var(--radius-control)] border border-border px-4 font-body text-body bg-cream"
        />
      </form>

      <div className="divide-y divide-border">
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/admin/customers/${c.id}`}
            className="flex items-center justify-between py-4 hover:bg-sage-light/30 -mx-4 px-4"
          >
            <div>
              <p className="font-body text-body font-medium text-charcoal">
                {c.name} {!c.isActive && <span className="text-error text-small">(Disabled)</span>}
              </p>
              <p className="font-body text-small text-muted mt-1">{c.email}</p>
            </div>
            <p className="font-body text-small text-muted">{c._count.orders} order(s)</p>
          </Link>
        ))}
        {customers.length === 0 && (
          <p className="font-body text-body text-muted py-8">No customers found.</p>
        )}
      </div>
    </div>
  );
}
