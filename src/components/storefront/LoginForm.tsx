"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/modules/accounts/actions";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await login({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });
      if (result.success) {
        router.push("/account");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-[420px] mx-auto px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Welcome Back
      </h1>
      <p className="font-body text-body text-muted text-center mt-4">Sign in to your account</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          />
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Password</label>
          <input
            name="password"
            type="password"
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
          className="w-full h-12 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
        >
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="text-center mt-6 pt-6 border-t border-border">
        <p className="font-body text-small text-muted">
          Don't have an account?{" "}
          <Link href="/register" className="text-sage font-medium">
            Create Account
          </Link>
        </p>
        <p className="font-body text-small text-muted mt-4">
          <Link href="/shop" className="text-sage font-medium">
            Continue as Guest
          </Link>
        </p>
      </div>
    </div>
  );
}
