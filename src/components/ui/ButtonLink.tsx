import Link from "next/link";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  ariaLabel,
}: Props) {
  return (
    <Link href={href} aria-label={ariaLabel} className={buttonClassName(variant, size, className)}>
      {children}
    </Link>
  );
}
