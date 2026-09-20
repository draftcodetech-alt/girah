import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCurrentUserProfile() {
  const session = await auth();
  if (!session?.user) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true },
  });
}
