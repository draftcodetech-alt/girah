import { auth } from "@/lib/auth";
import { logout } from "@/modules/accounts/actions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AccountPage() {
  const session = await auth();
  // Phase 4 L5: proxy.ts already gates /account/*, but the page checks for
  // itself too — a matcher misconfiguration must not render "Welcome back,
  // undefined" or an account shell to an anonymous request.
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Faccount");
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">My Account</h1>
      <p className="font-body text-body text-muted mt-2">Welcome back, {session.user.name}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link href="/account/orders" className="bg-sage-light rounded-[var(--radius-surface)] p-6 hover:bg-sage-light/70">
          <h2 className="font-body text-card-title text-charcoal">Orders</h2>
          <p className="font-body text-small text-muted mt-2">View your previous purchases</p>
        </Link>
        <Link href="/account/profile" className="bg-sage-light rounded-[var(--radius-surface)] p-6 hover:bg-sage-light/70">
          <h2 className="font-body text-card-title text-charcoal">Profile</h2>
          <p className="font-body text-small text-muted mt-2">Manage your account information</p>
        </Link>
      </div>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage-light text-charcoal"
        >
          Log Out
        </button>
      </form>
    </div>
  );
}
