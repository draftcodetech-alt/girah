"use server";
import { loginSchema, registerSchema, updateProfileSchema, changePasswordSchema, type LoginInput, type RegisterInput, type UpdateProfileInput, type ChangePasswordInput } from "./schema";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";

export type AccountActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

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
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unable to sign in right now. Please try again." };
    }
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately generic — never reveal whether the email exists. girah.md §13.1
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

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { email: "This email is already associated with an account." },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "CUSTOMER" },
  });

  try {
    // Auto sign-in after registration, per girah.md §13.2 (success -> My Account directly).
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch {
    // The account was genuinely created either way — don't report a false
    // failure for auto-login specifically if it somehow doesn't succeed.
  }

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
    where: { email: parsed.data.email, NOT: { id: session.user.id } },
  });
  if (emailTaken) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { email: "This email is already in use." },
    };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null },
  });

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