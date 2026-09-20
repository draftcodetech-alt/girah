import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/variations", label: "Variations" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reviews", label: "Reviews" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-suspenders: proxy.ts already blocks this at the routing level,
  // but a layout-level check ensures this holds even if proxy.ts config
  // ever changes without someone remembering this dependency.
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-border bg-sage-light">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center gap-8">
          <span className="font-[family-name:var(--font-display)] text-h3 text-charcoal">
            Girah Admin
          </span>
          <nav className="flex gap-6">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="font-body text-body text-charcoal">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">{children}</div>
    </div>
  );
}
