import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const GUEST_COOKIE_NAME = "girah_guest_id";

// Read-only — safe in Server Components. Returns null if no guest cart exists yet.
export async function getGuestId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;
}

// Mutating — only call from Server Actions / Route Handlers, never a Server Component render.
export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existing) return existing;

  const newId = randomUUID();
  cookieStore.set(GUEST_COOKIE_NAME, newId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return newId;
}

export async function clearGuestId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE_NAME);
}
