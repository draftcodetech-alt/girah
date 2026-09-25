import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export type FreshAccount = {
  isActive: boolean;
  role: Role;
  sessionVersion: number;
};

/**
 * Reads the account's CURRENT authorization state straight from the DB.
 * Used by the Auth.js `jwt` callback (every session read) and `requireAdmin`
 * so that disables, role changes, and session-version bumps take effect
 * immediately instead of living on in a stale JWT (Phase 1 C2).
 *
 * Returns null when the account no longer exists.
 */
export async function getFreshAccount(userId: string): Promise<FreshAccount | null> {
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, sessionVersion: true },
  });
}
