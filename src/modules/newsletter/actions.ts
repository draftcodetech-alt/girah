"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SubscribeResult =
  | { success: true; alreadySubscribed: boolean }
  | { success: false; error: string };

/**
 * Footer newsletter subscribe — the only writer for NewsletterSubscriber.
 * Idempotent by construction: the unique index collapses resubmits into
 * P2002, reported honestly as "already in the loop" (never an error, never
 * a duplicate row, never an existence oracle that matters — a newsletter
 * address is not sensitive).
 */
export async function subscribeNewsletter(rawEmail: string): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    await db.newsletterSubscriber.create({ data: { email } });
    return { success: true, alreadySubscribed: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: true, alreadySubscribed: true };
    }
    console.error("newsletter subscribe failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function getNewsletterSubscribers(): Promise<
  { id: string; email: string; createdAt: Date }[]
> {
  const { requireAdmin } = await import("@/lib/require-admin");
  await requireAdmin();
  return db.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
}

export async function deleteNewsletterSubscriber(id: string): Promise<{ success: boolean }> {
  const { requireAdmin } = await import("@/lib/require-admin");
  await requireAdmin();
  try {
    await db.newsletterSubscriber.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false };
  }
}
