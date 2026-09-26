import type { InputHTMLAttributes } from "react";

const SIZES = {
  md: "h-12 px-4",
  sm: "h-10 px-3",
} as const;

const BASE =
  "w-full rounded-[var(--radius-control)] border border-border bg-cream font-body text-body text-charcoal placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-sage";

// Omit React's numeric `size` attribute — here `size` is our visual variant.
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: keyof typeof SIZES;
};

export function Input({ size = "md", className = "", ...props }: InputProps) {
  return <input className={`${BASE} ${SIZES[size]} ${className}`} {...props} />;
}
