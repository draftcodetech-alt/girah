"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/modules/accounts/actions";

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await resetPassword({
        token: token ?? "",
        password: (formData.get("password") as string) ?? "",
        confirmPassword: (formData.get("confirmPassword") as string) ?? "",
      });
      if (result.success) {
        router.push("/login");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!token) {
    return (
      <div className="max-w-[420px] mx-auto px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">
          Reset Password
        </h1>
        <p role="alert" className="font-body text-body text-error mt-6">
          This reset link is invalid or has expired.
        </p>
        <p className="font-body text-small text-muted mt-6">
          <Link href="/forgot-password" className="text-sage font-medium">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[420px] mx-auto px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Reset Password
      </h1>
      <p className="font-body text-body text-muted text-center mt-4">
        Choose a new password for your account
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">
            New Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          />
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">
            Confirm Password
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          />
        </div>

        {error && (
          <p role="alert" className="font-body text-small text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-12 rounded-[var(--radius-control)] font-body text-button font-semibold uppercase tracking-[0.02em] bg-sage text-cream disabled:opacity-60"
        >
          {isPending ? "Updating…" : "Update Password"}
        </button>
      </form>

      <div className="text-center mt-6 pt-6 border-t border-border">
        <p className="font-body text-small text-muted">
          Remembered it?{" "}
          <Link href="/login" className="text-sage font-medium">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
