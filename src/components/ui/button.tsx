import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type StyleProps = {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
};

function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: StyleProps) {
  return cn("button", `button--${variant}`, `button--${size}`, className);
}

export function Button({
  variant,
  size,
  className,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps & { loading?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
    >
      {loading ? <span className="button-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  return (
    <Link {...props} className={buttonClass({ variant, size, className })} />
  );
}
