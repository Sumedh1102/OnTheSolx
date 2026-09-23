import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-display font-bold tracking-tight " +
  "border-ink rounded-[var(--radius-control)] transition-[transform,box-shadow,background-color] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand";

const lift =
  "shadow-brutal-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: `border-[2.5px] bg-brand text-white ${lift} hover:bg-brand-600`,
  dark: `border-[2.5px] bg-ink text-white ${lift}`,
  outline: `border-[2.5px] bg-white text-ink ${lift} hover:bg-paper`,
  soft: `border-[2.5px] bg-brand-50 text-brand-700 ${lift} hover:bg-brand-100`,
  danger: `border-[2.5px] bg-danger text-white ${lift}`,
  ghost: "border-2 border-transparent bg-transparent text-ink hover:bg-ink/5 hover:border-ink/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-6 text-base",
  xl: "h-16 px-8 text-lg rounded-2xl",
  icon: "h-10 w-10 p-0",
};

export function buttonStyles({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonStyles({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
