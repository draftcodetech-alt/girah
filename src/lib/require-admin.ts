import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFreshAccount } from "@/lib/account-guard";

/**
 * Call this at the top of every admin Server Action.
 * Never returns a silent false, so a forgotten check fails loud, not quiet.
 *
 * Phase 1 C2: re-reads the account from the DB instead of trusting the
 * session claim alone, so a disabled admin or a role change takes effect
 * even if the JWT predates it.
 *
 * Phase 4 L4: redirect() instead of a bare Error — "Unauthorized" used to
 * surface as a 500 error-boundary page for the routine not-signed-in case.
 * Targets mirror src/proxy.ts: anonymous -> /login, signed-in-but-not-admin
 * -> /. redirect() still throws (NEXT_REDIRECT), never a silent false.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const account = await getFreshAccount(session.user.id);
  if (!account || !account.isActive || account.role !== "ADMIN") {
    redirect("/");
  }

  return session;
}
