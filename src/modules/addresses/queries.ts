import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SavedShippingView } from "./schema";

/**
 * The signed-in customer's saved shipping address (single per user), or
 * null for guests / users who never saved one. Plain query — no mutation.
 */
export async function getMyShippingAddress(): Promise<SavedShippingView | null> {
  const session = await auth();
  if (!session?.user) return null;

  const saved = await db.savedShipping.findUnique({
    where: { userId: session.user.id },
  });
  if (!saved) return null;

  return {
    fullName: saved.fullName,
    phone: saved.phone,
    address: saved.address,
    city: saved.city,
    postalCode: saved.postalCode,
  };
}
