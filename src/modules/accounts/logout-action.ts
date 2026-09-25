"use server";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export async function logout() {
  // Phase 4 M4: bump the version BEFORE clearing this browser's cookie —
  // logout must kill every live session for the account, including a copied
  // or stolen cookie (which would otherwise keep working — and renewing its
  // own 30-day expiry — until idle timeout). Same one-counter-all-devices
  // semantics as changePassword; remaining devices just sign in again.
  const session = await auth();
  if (session?.user) {
    await db.user.update({
      where: { id: session.user.id },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  await signOut({ redirectTo: "/" });
}
