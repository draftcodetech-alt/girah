"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/modules/accounts/actions";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset({
        email: (formData.get("email") as string) ?? "",
      });
      if (result.success) {
        // Always the generic confirmation — the response never reveals
        // whether the account exists.
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-[420px] mx-auto px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Forgot Password
      </h1>
      <p className="font-body text-body text-muted text-center mt-4">
        Enter your email and we&apos;ll send you a reset link
      </p>

      {sent ? (
        <div className="mt-8 rounded-[var(--radius-control)] border border-border bg-cream px-4 py-5">
          <p role="status" className="font-body text-body text-charcoal text-center">
            If that address has an account, a reset link is on its way. Check
            your inbox — the link expires in 1 hour.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="font-body text-small text-charcoal block mb-1.5">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
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
            {isPending ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      )}

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
