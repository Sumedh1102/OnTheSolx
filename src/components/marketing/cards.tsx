import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock, MapPin, Quote, Users } from "lucide-react";
import { Shuttlecock } from "@/components/brand/illustrations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatMinutes, formatMoney, monthShort, titleCase } from "@/lib/format";
import { WEEKDAYS_SHORT } from "@/lib/time";
import { cn, initials } from "@/lib/utils";
import type { PublicCoach, PublicEvent, PublicPlan, PublicProgram } from "@/server/queries/public";

const LEVEL_TONES: Record<string, string> = {
  BEGINNER: "bg-white",
  INTERMEDIATE: "bg-brand-100",
  ADVANCED: "bg-brand text-white",
  KIDS: "bg-warning-soft",
};

export function ProgramCard({ program, detailed }: { program: PublicProgram; detailed?: boolean }) {
  const dark = program.level === "ADVANCED";
  return (
    <article id={program.slug} className={cn("flex h-full scroll-mt-28 flex-col rounded-[var(--radius-card)] border-3 border-ink shadow-brutal brutal-hover", LEVEL_TONES[program.level])}>
      <div className="flex items-start justify-between gap-3 border-b-3 border-ink p-5">
        <div>
          <Badge tone={dark ? "outline" : "ink"}>{titleCase(program.level)}</Badge>
          <h3 className="mt-3 text-2xl font-extrabold leading-tight">{program.name}</h3>
          <p className={cn("mt-1 text-sm font-semibold", dark ? "text-white/80" : "text-muted")}>{program.tagline}</p>
        </div>
        <Shuttlecock className="size-10 shrink-0 rotate-12" feather={dark ? "#ffffff" : "#ffffff"} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {detailed ? <p className={cn("mb-5 leading-relaxed", dark ? "text-white/90" : "text-ink-soft")}>{program.description}</p> : null}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Age group", program.ageGroup],
            ["Frequency", program.frequency],
            ["Session", program.sessionDuration],
            ["Duration", program.programLength],
          ].map(([k, v]) => (
            <div key={k} className={cn("rounded-xl border-2 border-ink px-3 py-2", dark ? "bg-white/10 border-white" : "bg-white")}>
              <dt className={cn("text-[11px] font-bold uppercase tracking-wider", dark ? "text-white/70" : "text-muted")}>{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {detailed && program.highlights.length ? (
          <ul className="mt-5 grid gap-2 text-sm">
            {program.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 font-semibold">
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} /> {h}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <div>
            <p className={cn("text-xs font-bold uppercase tracking-wider", dark ? "text-white/70" : "text-muted")}>From</p>
            <p className="font-display text-3xl font-extrabold leading-none">
              {formatMoney(program.monthlyFee)}
              <span className={cn("text-sm font-bold", dark ? "text-white/70" : "text-muted")}>/mo</span>
            </p>
            {program.coachName ? <p className={cn("mt-1 text-xs font-semibold", dark ? "text-white/80" : "text-muted")}>Lead coach · {program.coachName}</p> : null}
          </div>
          <ButtonLink href={detailed ? `/contact?topic=${program.slug}` : `/coaching#${program.slug}`} variant={dark ? "outline" : "dark"} size="sm">
            {detailed ? "Book a trial" : "Details"} <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}

const PORTRAIT_TONES = ["grid-paper-blue", "grid-paper-ink", "bg-brand-100", "bg-warning-soft"];

export function CoachPortrait({ coach, index = 0, className }: { coach: Pick<PublicCoach, "name" | "photoUrl">; index?: number; className?: string }) {
  const tone = PORTRAIT_TONES[index % PORTRAIT_TONES.length]!;
  const darkBg = tone.startsWith("grid-paper");
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden border-b-3 border-ink", tone, className)}>
      {coach.photoUrl ? (
        <Image src={coach.photoUrl} alt={`Portrait of ${coach.name}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
      ) : (
        <>
          <span className={cn("absolute inset-0 grid place-items-center font-display text-[7rem] font-extrabold leading-none tracking-tighter", darkBg ? "text-white" : "text-ink")}>
            {initials(coach.name)}
          </span>
          <Shuttlecock className="absolute bottom-4 right-4 size-12 rotate-[20deg]" />
          <span className="sr-only">Photo coming soon for {coach.name}</span>
        </>
      )}
    </div>
  );
}

export function CoachCard({ coach, index = 0, detailed }: { coach: PublicCoach; index?: number; detailed?: boolean }) {
  return (
    <article id={coach.slug} className="flex h-full scroll-mt-28 flex-col overflow-hidden rounded-[var(--radius-card)] border-3 border-ink bg-white shadow-brutal brutal-hover">
      <CoachPortrait coach={coach} index={index} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-2xl font-extrabold leading-tight">{coach.name}</h3>
            <p className="font-bold text-brand">{coach.title}</p>
          </div>
          <span className="shrink-0 rounded-xl border-2 border-ink bg-warning-soft px-2 py-1 text-center font-display leading-none">
            <span className="block text-xl font-extrabold">{coach.experienceYears}</span>
            <span className="text-[10px] font-bold uppercase">yrs</span>
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          <span className="text-muted">Specialisation · </span>
          {coach.specialization}
        </p>
        {detailed ? (
          <>
            <p className="mt-4 leading-relaxed text-ink-soft">{coach.bio}</p>
            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Certifications</p>
              <ul className="flex flex-wrap gap-1.5">
                {coach.certifications.map((c) => (
                  <li key={c} className="rounded-lg border-2 border-ink bg-brand-50 px-2 py-1 text-xs font-bold">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            {coach.achievements.length ? (
              <ul className="mt-4 grid gap-1.5 text-sm">
                {coach.achievements.map((a) => (
                  <li key={a} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={3} />
                    <span className="font-semibold">{a}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <Link href={`/coaches#${coach.slug}`} className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-extrabold hover:text-brand">
            View profile <ArrowUpRight className="size-4" strokeWidth={2.75} />
          </Link>
        )}
      </div>
    </article>
  );
}

export function PlanCard({ plan, ctaHref }: { plan: PublicPlan; ctaHref: string }) {
  const featured = plan.isFeatured;
  const perMonth = Math.round(plan.price / plan.durationMonths / 100) * 100;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-[var(--radius-card)] border-3 border-ink p-6 brutal-hover",
        featured ? "bg-brand text-white shadow-brutal-lg lg:-translate-y-3" : "bg-white shadow-brutal",
      )}
    >
      {featured ? (
        <span className="absolute -top-4 left-6 rotate-[-3deg] rounded-lg border-[2.5px] border-ink bg-warning px-3 py-1 font-display text-sm font-extrabold text-ink shadow-brutal-xs">
          Most popular
        </span>
      ) : null}
      <h3 className="text-2xl font-extrabold">{plan.name}</h3>
      <p className={cn("mt-1 min-h-10 text-sm font-semibold", featured ? "text-white/80" : "text-muted")}>{plan.description}</p>
      <p className="mt-5 font-display text-5xl font-extrabold leading-none tracking-tight">{formatMoney(plan.price)}</p>
      <p className={cn("mt-2 text-sm font-bold", featured ? "text-white/80" : "text-muted")}>
        {plan.durationMonths} {plan.durationMonths === 1 ? "month" : "months"}
        {plan.durationMonths > 1 ? ` · ≈ ${formatMoney(perMonth)}/mo` : ""}
      </p>
      <div className={cn("mt-5 rounded-xl border-2 px-3 py-2 text-sm font-bold", featured ? "border-white bg-white/10" : "border-ink bg-brand-50")}>
        {plan.trainingAccess}
      </div>
      <ul className="mt-5 grid gap-2.5 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex gap-2">
            <span className={cn("mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border-2", featured ? "border-white bg-white text-brand" : "border-ink bg-brand text-white")}>
              <Check className="size-3" strokeWidth={4} />
            </span>
            <span className="font-semibold">{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <ButtonLink href={ctaHref} variant={featured ? "outline" : "dark"} className="w-full">
          Choose {plan.name}
        </ButtonLink>
      </div>
    </article>
  );
}

const CATEGORY_LABEL: Record<string, string> = { TOURNAMENT: "Tournament", WORKSHOP: "Workshop", CAMP: "Camp", SOCIAL: "Social", TRIAL: "Free trial" };

export function EventCard({ event }: { event: PublicEvent }) {
  const d = new Date(`${event.date}T00:00:00Z`);
  const spots = event.registrationLimit ? Math.max(0, event.registrationLimit - event.registered) : null;
  return (
    <Link href={`/events/${event.slug}`} className="group block h-full rounded-[var(--radius-card)]">
      <article className="flex h-full overflow-hidden rounded-[var(--radius-card)] border-3 border-ink bg-white shadow-brutal brutal-hover">
        <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r-3 border-ink bg-brand px-2 py-4 text-white sm:w-28">
          <span className="font-mono text-xs font-bold uppercase">{monthShort(d.getUTCMonth())}</span>
          <span className="font-display text-5xl font-extrabold leading-none">{d.getUTCDate()}</span>
          <span className="mt-1 text-xs font-bold uppercase opacity-80">{WEEKDAYS_SHORT[d.getUTCDay()]}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={event.category === "TOURNAMENT" ? "ink" : event.category === "TRIAL" ? "green" : "blue"}>{CATEGORY_LABEL[event.category]}</Badge>
            {spots !== null && spots <= 10 ? <Badge tone={spots === 0 ? "red" : "yellow"}>{spots === 0 ? "Full" : `${spots} spots left`}</Badge> : null}
          </div>
          <h3 className="mt-3 text-xl font-extrabold leading-tight group-hover:text-brand">{event.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{event.summary}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {formatMinutes(event.startMinute)}
              {event.endDate ? ` · till ${formatDate(event.endDate, "dayMonth")}` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">{event.fee ? formatMoney(event.fee) : "Free"}</span>
            {event.registrationLimit ? (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Users className="size-4" /> {event.registered}/{event.registrationLimit}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}

export function EventMeta({ event }: { event: PublicEvent }) {
  return (
    <ul className="grid gap-3 text-sm font-semibold">
      <li className="flex gap-2.5">
        <CalendarDays className="size-4 shrink-0" />
        {formatDate(event.date, "long")}
        {event.endDate ? ` – ${formatDate(event.endDate, "long")}` : ""}
      </li>
      <li className="flex gap-2.5">
        <Clock className="size-4 shrink-0" />
        {formatMinutes(event.startMinute)}
        {event.endMinute ? ` – ${formatMinutes(event.endMinute)}` : ""}
      </li>
      <li className="flex gap-2.5">
        <MapPin className="size-4 shrink-0" />
        {event.venue}
      </li>
    </ul>
  );
}

export function TestimonialCard({ quote, name, role, index }: { quote: string; name: string; role: string; index: number }) {
  const tone = index % 3 === 1 ? "bg-brand text-white" : index % 3 === 2 ? "bg-brand-50" : "bg-white";
  return (
    <figure className={cn("flex h-full flex-col rounded-[var(--radius-card)] border-3 border-ink p-6 shadow-brutal", tone)}>
      <Quote className="size-8" strokeWidth={2.75} aria-hidden />
      <blockquote className="mt-4 flex-1 text-lg font-semibold leading-snug">“{quote}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border-2 border-ink bg-white font-display font-extrabold text-ink">{initials(name)}</span>
        <span>
          <span className="block font-extrabold">{name}</span>
          <span className={cn("text-sm font-semibold", index % 3 === 1 ? "text-white/80" : "text-muted")}>{role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <details key={item.q} className="group rounded-2xl border-3 border-ink bg-white shadow-brutal-sm open:shadow-brutal [&_summary::-webkit-details-marker]:hidden" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-lg font-extrabold">
            {item.q}
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border-2 border-ink bg-brand-50 transition group-open:bg-brand group-open:text-white" aria-hidden>
              <span className="text-xl leading-none transition group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="px-5 pb-5 leading-relaxed text-ink-soft">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
