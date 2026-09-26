import { db } from "@/lib/db";
import type { SavedShippingInput, SavedShippingView } from "./schema";

function toValues(data: SavedShippingInput) {
  return {
    fullName: data.fullName,
    phone: data.phone,
    address: data.address,
    city: data.city,
    postalCode: data.postalCode || null,
  };
}

/**
 * Upsert the customer's single saved shipping address. Shared by the
 * /account/addresses action and checkout's best-effort save-after-order
 * so both write the exact same shape.
 */
export async function upsertSavedShippingForUser(
  userId: string,
  data: SavedShippingInput
): Promise<SavedShippingView> {
  const values = toValues(data);
  const saved = await db.savedShipping.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
  return {
    fullName: saved.fullName,
    phone: saved.phone,
    address: saved.address,
    city: saved.city,
    postalCode: saved.postalCode,
  };
}
