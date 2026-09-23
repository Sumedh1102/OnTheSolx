import Link from "next/link";
import { cn } from "@/lib/utils";
import { Shuttlecock } from "./illustrations";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border-[2.5px] border-ink bg-brand shadow-brutal-xs", className)}>
      <Shuttlecock className="size-7 -rotate-[20deg]" band="#ffffff" />
    </span>
  );
}

export function Logo({ className, href = "/", inverted }: { className?: string; href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="SmashPoint Badminton Academy — home">
      <LogoMark className="transition-transform group-hover:-rotate-6" />
      <span className="leading-none">
        <span className={cn("block font-display text-xl font-extrabold tracking-tight", inverted ? "text-white" : "text-ink")}>
          SmashPoint<span className="text-brand">.</span>
        </span>
        <span className={cn("block text-[10px] font-bold uppercase tracking-[0.18em]", inverted ? "text-white/70" : "text-muted")}>Badminton Academy</span>
      </span>
    </Link>
  );
}
