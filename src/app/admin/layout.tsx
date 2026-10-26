import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/AdminChrome";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/newsletter", label: "Newsletter" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-suspenders: proxy.ts already blocks this at the routing level,
  // but a layout-level check ensures this holds even if proxy.ts config
  // ever changes without someone remembering this dependency.
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const userName = session.user.name?.trim() || session.user.email || "Admin";

  return (
    <AdminChrome items={NAV_ITEMS} userName={userName}>
      <main id="main-content" className="ax-page">
        {children}
      </main>
    </AdminChrome>
  );
}
