import { auth } from "@/lib/auth";
import { getGuestId, getOrCreateGuestId } from "./guest";

export type CartIdentity = { userId: string } | { guestId: string };

// Read-only — safe in Server Components.
export async function resolveCartIdentityReadOnly(): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user) return { userId: session.user.id };
  const guestId = await getGuestId();
  return guestId ? { guestId } : null;
}

// Mutating — only call from Server Actions.
export async function resolveCartIdentity(): Promise<CartIdentity> {
  const session = await auth();
  if (session?.user) return { userId: session.user.id };
  const guestId = await getOrCreateGuestId();
  return { guestId };
}
