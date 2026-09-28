"use server";
import { loginSchema, registerSchema, updateProfileSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, type LoginInput, type RegisterInput, type UpdateProfileInput, type ChangePasswordInput, type ForgotPasswordInput, type ResetPasswordInput } from "./schema";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth, signIn, signOut } from "@/lib/auth";
import { readSessionFromCookieJar } from "@/lib/session";
import { mergeGuestCartForCurrentUser } from "@/modules/cart";
import { sendEmailSafe } from "@/lib/email";
import { welcomeEmail, passwordResetEmail } from "@/lib/email-templates";
import { isRateLimited, recordFailure } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type AccountActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// Phase 17: registration throttle — same bucket logic as login/password
// reset. Keyed by client IP (Cloudflare's cf-connecting-ip when proxied,
// x-forwarded-for otherwise) so a bot can't mass-create accounts; per-email
// limits wouldn't stop the flood since every attempt uses a new address.
const REGISTER_RATE = { max: 10, windowMs: 15 * 60 * 1000 };

async function registerRateKey(): Promise<string> {
  // Server actions run in a request scope, but integration tests call this
  // action directly outside one — degrade to a shared bucket instead of
  // throwing. Test runs are skipped entirely below anyway.
  try {
    const h = await headers();
    return (
      h.get("cf-connecting-ip")?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export async function login(input: LoginInput): Promise<AccountActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check the highlighted fields." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    // Auth.js swallows some failures (e.g. config errors) as a non-throwing
    // Response — never report success without proof of a live session (C3).
    // `auth()` can't provide that proof in here: it reads the incoming request
    // headers, which never receive the cookie signIn() just wrote. Read the
    // session from the cookie jar instead, and require it to belong to the
    // credentials just verified — a leftover session for some other account
    // must not count as signing in.
    const session = await readSessionFromCookieJar();
    if (!session?.email || session.email.trim().toLowerCase() !== parsed.data.email) {
      return { success: false, error: "Unable to sign in right now. Please try again." };
    }
    // Phase 5: fold this browser's guest cart into the account — otherwise
    // identity flips to {userId} and the guest cart is orphaned. Best-effort:
    // a merge failure must never fail a successful login (the guest cookie is
    // only cleared after a successful merge, so the next login retries).
    try {
      await mergeGuestCartForCurrentUser(session.id);
    } catch (mergeError) {
      console.error("guest-cart merge failed:", mergeError);
    }
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately generic — never reveal whether the email exists.
      return { success: false, error: "Invalid email or password." };
    }
    throw error;
  }
}

export async function register(input: RegisterInput): Promise<AccountActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  // Throttle BEFORE the existence check so the limit can't be used as an
  // oracle and a flood costs at most one DB read per attempt. Skipped under
  // NODE_ENV=test (integration suites legitimately register repeatedly).
  if (process.env.NODE_ENV !== "test") {
    const rateKey = `register:${await registerRateKey()}`;
    if (isRateLimited(rateKey, REGISTER_RATE)) {
      return { success: false, error: "Too many attempts — please wait a few minutes and try again." };
    }
    recordFailure(rateKey, REGISTER_RATE);
  }

  // Phase 4 L1: case-insensitive so a mixed-case variant of an existing
  // account (including legacy mixed-case rows) can't create a twin.
  const existing = await db.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
  });
  if (existing) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { email: "This email is already associated with an account." },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  let createdId: string;
  try {
    const created = await db.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "CUSTOMER" },
    });
    createdId = created.id;
  } catch (error) {
    // Phase 4 L2: the pre-check above closes the common case; this covers the
    // race where two submits slip past it. Schema normalization guarantees
    // both racers wrote the same lowercase value, so the unique index fires.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: "Please check the highlighted fields.",
        fieldErrors: { email: "This email is already associated with an account." },
      };
    }
    throw error;
  }

  try {
    // Auto sign-in after registration (success -> My Account directly).
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch {
    // The account was genuinely created either way — don't report a false
    // failure for auto-login specifically if it somehow doesn't succeed.
  }

  // Phase 5: merge the browser's guest cart — but ONLY once a live session
  // for THIS new account exists, so the user never loses sight of the cart
  // they were building while signed out (if auto sign-in failed, the cookie
  // stays and the next login merges). Same cookie-jar read as login(): a
  // leftover session for some other account must not trigger the merge.
  const session = await readSessionFromCookieJar();
  if (session && session.id === createdId) {
    try {
      await mergeGuestCartForCurrentUser(session.id);
    } catch (mergeError) {
      console.error("guest-cart merge failed:", mergeError);
    }
  }

  // Phase 14: welcome email — best-effort, after the account exists.
  await sendEmailSafe(welcomeEmail({ to: parsed.data.email, name: parsed.data.name }));

  return { success: true };
}

export async function updateProfile(input: UpdateProfileInput): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const emailTaken = await db.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" }, NOT: { id: session.user.id } },
  });
  if (emailTaken) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { email: "This email is already in use." },
    };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null },
    });
  } catch (error) {
    // Phase 4 L2: covers the TOCTOU race around the pre-check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: "Please check the highlighted fields.",
        fieldErrors: { email: "This email is already in use." },
      };
    }
    throw error;
  }

  return { success: true };
}

export async function changePassword(input: ChangePasswordInput): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, error: "Account not found." };
  }

  const isCurrentValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { currentPassword: "Current password is incorrect." },
    };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  // sessionVersion bump rotates every live session for this account — a
  // stolen token must not survive a password change (Phase 1 C2).
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash, sessionVersion: { increment: 1 } },
  });

  return { success: true };
}

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

// ── Phase 14: forgot / reset password ───────────────────────────────────────
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE = { max: 5, windowMs: 15 * 60 * 1000 };

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Always answers the same generic success — the response (and its rate-limit
 * key being identical for existing and missing accounts) must never reveal
 * whether an account exists. Real sends delete the user's previous tokens
 * first, so only ONE live link exists at a time.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<AccountActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const email = parsed.data.email;

  // Keyed by email so one address can't be bombed with mail; counted for
  // EVERY attempt (existing or not) — otherwise the limit itself would be an
  // existence oracle.
  const rateKey = `pwreset:${email}`;
  if (isRateLimited(rateKey, RESET_RATE)) {
    return { success: false, error: "Too many reset requests — please wait a few minutes and try again." };
  }
  recordFailure(rateKey, RESET_RATE);

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await sendEmailSafe(
      passwordResetEmail({
        to: user.email,
        name: user.name,
        link: `${base}/reset-password?token=${token}`,
      })
    );
  }
  return { success: true };
}

/**
 * Single-use link: the hashed token is looked up once, the whole token set
 * is consumed on success, and sessionVersion bumps so any live session
 * (e.g. a stolen cookie) dies with the old password — the changePassword rule.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<AccountActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(parsed.data.token) },
    include: { user: true },
  });
  const invalid = !record || !record.user || record.expiresAt.getTime() <= Date.now();
  if (invalid) {
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
  });
  return { success: true };
}
