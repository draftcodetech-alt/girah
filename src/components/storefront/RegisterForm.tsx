"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/modules/accounts/actions";

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await register({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        confirmPassword: formData.get("confirmPassword") as string,
      });
      if (result.success) {
        router.push("/account");
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const inputClass = (field: string) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-sage bg-cream ${
      fieldErrors[field] ? "border-error" : "border-border"
    }`;

  return (
    <div className="max-w-[420px] mx-auto px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal text-center">
        Create Account
      </h1>
      <p className="font-body text-body text-muted text-center mt-4">Create your Girah account</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Name</label>
          <input name="name" required className={inputClass("name")} />
          {fieldErrors.name && <p role="alert" className="text-small text-error mt-1">{fieldErrors.name}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Email</label>
          <input name="email" type="email" required className={inputClass("email")} />
          {fieldErrors.email && <p role="alert" className="text-small text-error mt-1">{fieldErrors.email}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Password</label>
          <input name="password" type="password" required className={inputClass("password")} />
          {fieldErrors.password && <p role="alert" className="text-small text-error mt-1">{fieldErrors.password}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Confirm Password</label>
          <input name="confirmPassword" type="password" required className={inputClass("confirmPassword")} />
          {fieldErrors.confirmPassword && (
            <p role="alert" className="text-small text-error mt-1">{fieldErrors.confirmPassword}</p>
          )}
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
          {isPending ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div className="text-center mt-6 pt-6 border-t border-border">
        <p className="font-body text-small text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-sage font-medium">
            Sign In
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
