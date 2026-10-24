"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/modules/accounts/actions";
import { safeCallbackUrl } from "@/lib/callback-url";

/**
 * Owner spec (single-owner store): the ONLY sign-in form that can produce an
 * ADMIN session. Not linked from anywhere — reached by typing
 * /executive/login manually. The storefront /login refuses admin credentials
 * (channel gate in lib/channel-gate.ts, enforced in authorize() too).
 */
export function ExecutiveLoginForm({ callbackUrl }: { callbackUrl?: string }) {
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
        channel: "executive",
      });
      if (result.success) {
        // Default landing is the admin dashboard; the proxy's callbackUrl
        // (e.g. /admin/orders/…) wins when present.
        router.push(safeCallbackUrl(callbackUrl, "/admin"));
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-[420px] mx-auto px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center uppercase">
        Executive Access
      </h1>
      <p className="font-body text-body text-muted text-center mt-4">
        Owner sign-in for the Girah back office
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5" htmlFor="executive-email">Email</label>
          <input
            id="executive-email" name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-cream px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          />
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5" htmlFor="executive-password">Password</label>
          <input
            id="executive-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
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
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="text-center mt-6 pt-6 border-t border-border">
        <p className="font-body text-small text-muted">
          <Link href="/shop" className="text-sage font-medium">
            Back to the store
          </Link>
        </p>
      </div>
    </div>
  );
}
