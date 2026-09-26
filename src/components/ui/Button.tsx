import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-sage text-cream hover:bg-charcoal",
  secondary: "bg-sage-light text-charcoal hover:bg-sage-light/70",
  outline: "border border-sage text-sage hover:bg-sage-light",
  ghost: "text-sage hover:text-charcoal",
} as const;

const SIZES = {
  md: "h-12 px-6",
  sm: "h-9 px-4",
} as const;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-body text-button font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:opacity-60 disabled:cursor-not-allowed";

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClassName(variant, size, className)} {...props} />
  );
}
