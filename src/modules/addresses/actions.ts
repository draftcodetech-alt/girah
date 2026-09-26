"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { savedShippingSchema, type SavedShippingInput } from "./schema";
import { upsertSavedShippingForUser } from "./ops";

export type AddressActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function saveShippingAddress(
  input: SavedShippingInput
): Promise<AddressActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = savedShippingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  await upsertSavedShippingForUser(session.user.id, parsed.data);
  revalidatePath("/account/addresses");
  // The saved address pre-fills checkout — a fresh checkout must see it.
  revalidatePath("/checkout");
  return { success: true };
}

export async function deleteShippingAddress(): Promise<AddressActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }

  // deleteMany (not delete) — no error if the row was already removed.
  await db.savedShipping.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { success: true };
}
