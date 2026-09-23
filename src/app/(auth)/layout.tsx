import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CourtDiagram, Shuttlecock } from "@/components/brand/illustrations";
import { Logo } from "@/components/brand/logo";
import { site } from "@/content/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="grid-paper-blue relative hidden overflow-hidden border-r-3 border-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo inverted />
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/80">Member portal</p>
          <p className="mt-4 font-display text-6xl font-extrabold leading-[0.92] tracking-tight xl:text-7xl">Your game, all in one place.</p>
          <p className="mt-5 max-w-md text-lg text-white/85">Bookings, attendance, membership, skill scores and receipts — for players, parents and staff.</p>
        </div>
        <div className="relative">
          <div className="rotate-[-2deg] rounded-2xl border-3 border-ink bg-white p-3 shadow-brutal-lg">
            <div className="rounded-xl border-3 border-ink bg-brand p-3">
              <CourtDiagram />
            </div>
          </div>
          <Shuttlecock className="absolute -right-2 -top-8 size-16 rotate-[18deg]" />
        </div>
        <p className="text-sm text-white/70">© {new Date().getFullYear()} {site.name}</p>
      </section>
      <section className="flex flex-col px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link href="/" className="ml-auto inline-flex items-center gap-1 text-sm font-bold hover:text-brand">
            <ArrowLeft className="size-4" /> Back to site
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </section>
    </main>
  );
}
