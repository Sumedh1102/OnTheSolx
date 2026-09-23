import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto rounded-2xl border-3 border-ink bg-white shadow-brutal", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[640px] border-collapse text-left text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b-3 border-ink bg-paper-2", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("whitespace-nowrap px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-ink", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b-2 border-ink/10 last:border-b-0 transition-colors hover:bg-brand-50/60", className)} {...props} />;
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

/** Column header that toggles ?sort=field&dir=asc|desc while preserving other params. */
export function SortableTH({
  label,
  field,
  sort,
  dir,
  hrefFor,
  className,
}: {
  label: ReactNode;
  field: string;
  sort?: string;
  dir?: "asc" | "desc";
  hrefFor: (sort: string, dir: "asc" | "desc") => string;
  className?: string;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={hrefFor(field, nextDir)} className="inline-flex items-center gap-1 hover:text-brand">
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} strokeWidth={2.75} aria-hidden />
      </Link>
    </TH>
  );
}
