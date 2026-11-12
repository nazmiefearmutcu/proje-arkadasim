import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";
import { focusRing, focusRingInverse } from "./styles";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "inverse-outline";
export type ButtonSize = "md" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-pen text-pen-ink hover:bg-pen-strong",
  secondary: "border-[1.5px] border-pen bg-surface text-pen hover:bg-pen-soft",
  /** Mavi zemin üzerindeki birincil düğme (açılış paneli): beyaz zemin, mavi yazı. */
  inverse: "bg-surface text-pen hover:bg-pen-soft",
  /** Mavi zemin üzerindeki ikincil düğme: beyaz çerçeve. */
  "inverse-outline": "border-[1.5px] border-pen-ink text-pen-ink hover:bg-white/15",
  ghost: "text-pen hover:bg-pen-soft",
  danger: "bg-danger text-surface hover:opacity-90",
};

// md: 44 px dokunma hedefi (varsayılan); sm: 36 px, yalnız sıkı yüzeylerde.
const sizeClasses: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-[14px]",
  sm: "h-9 px-3 text-[13px]",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-[650] whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    variant === "inverse" || variant === "inverse-outline" ? focusRingInverse : focusRing,
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps
  extends LinkProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({ variant, size, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
