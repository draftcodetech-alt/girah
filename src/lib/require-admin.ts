import { auth } from "@/lib/auth";
import { getFreshAccount } from "@/lib/account-guard";

/**
 * Call this at the top of every admin Server Action, starting in Phase 8.
 * Throws if the caller isn't an authenticated admin — never returns a
 * silent false, so a forgotten check fails loud, not quiet.
 *
 * Phase 1 C2: re-reads the account from the DB instead of trusting the
 * session claim alone, so a disabled admin or a role change takes effect
 * even if the JWT predates it.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: admin access required");
  }

  const account = await getFreshAccount(session.user.id);
  if (!account || !account.isActive || account.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }

  return session;
}
