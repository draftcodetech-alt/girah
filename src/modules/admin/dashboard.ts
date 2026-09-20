"use server";

import { requireAdmin } from "@/lib/require-admin";

// Temporary proof-of-concept action — real admin actions arrive in 8.2+.
// This exists solely to verify requireAdmin() actually throws for non-admins.
export async function testAdminAction() {
  await requireAdmin();
  return { success: true, message: "You are an admin." };
}
