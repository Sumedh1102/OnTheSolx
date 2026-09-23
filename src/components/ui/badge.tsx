import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "blue" | "green" | "yellow" | "red" | "ink" | "outline" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-paper-2 text-ink",
  blue: "bg-brand-100 text-brand-700",
  brand: "bg-brand text-white",
  green: "bg-success-soft text-[#0b6b35]",
  yellow: "bg-warning-soft text-[#7a5200]",
  red: "bg-danger-soft text-[#a4161a]",
  ink: "bg-ink text-white",
  outline: "bg-white text-ink",
};

export function Badge({ tone = "neutral", dot, className, children, ...props }: ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  // bookings
  PENDING: "yellow",
  PAYMENT_INITIATED: "yellow",
  PAID: "blue",
  CONFIRMED: "green",
  CANCELLED: "red",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
  // payments
  CREATED: "neutral",
  INITIATED: "yellow",
  FAILED: "red",
  // memberships / students
  ACTIVE: "green",
  INACTIVE: "neutral",
  SUSPENDED: "red",
  // attendance
  PRESENT: "green",
  ABSENT: "red",
  LATE: "yellow",
  LEAVE: "blue",
  // events
  DRAFT: "neutral",
  PUBLISHED: "green",
  COMPLETED: "ink",
  WAITLISTED: "yellow",
  // courts
  MAINTENANCE: "yellow",
  // enquiries
  NEW: "blue",
  IN_PROGRESS: "yellow",
  CLOSED: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_INITIATED: "Payment initiated",
  IN_PROGRESS: "In progress",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot className={className}>
      {label}
    </Badge>
  );
}
