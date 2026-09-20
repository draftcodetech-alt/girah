import { auth } from "@/lib/auth";

/**
 * Call this at the top of every admin Server Action, starting in Phase 8.
 * Throws if the caller isn't an authenticated admin — never returns a
 * silent false, so a forgotten check fails loud, not quiet.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}