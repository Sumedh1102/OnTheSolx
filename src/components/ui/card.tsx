import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "white" | "paper" | "blue" | "ink" | "brand-soft";
type Shadow = "none" | "sm" | "md" | "lg";

const tones: Record<Tone, string> = {
  white: "bg-white text-ink",
  paper: "bg-paper text-ink",
  blue: "bg-brand text-white",
  ink: "bg-ink text-white",
  "brand-soft": "bg-brand-50 text-ink",
};

const shadows: Record<Shadow, string> = {
  none: "",
  sm: "shadow-brutal-sm",
  md: "shadow-brutal",
  lg: "shadow-brutal-lg",
};

export function Card({
  tone = "white",
  shadow = "md",
  interactive,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: Tone; shadow?: Shadow; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border-3 border-ink",
        tones[tone],
        shadows[shadow],
        interactive && "brutal-hover",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b-3 border-ink px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-ink bg-brand-100 text-brand-700">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold leading-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
