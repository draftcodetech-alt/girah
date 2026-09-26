import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
};

// Repo-wide convention: validation feedback is a role="alert" paragraph under
// the control (see README conventions) — Field gives every form the same shape.
export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block font-body text-small text-charcoal mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="font-body text-small text-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
