import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { announcements, coaches, courts, eventRegistrations, events, membershipPlans, programs, users } from "@/server/db/schema";
import { todayInTz } from "@/lib/time";
import { TAGS } from "@/server/cache";

/*
 * Cached read models for the public website. Values are JSON-serialisable (dates as ISO
 * strings) because unstable_cache persists them. Admin mutations call invalidate(TAG).
 */
const REVALIDATE = 300;

export const getPublicCoaches = unstable_cache(
  async () =>
    db
      .select({
        id: coaches.id,
        slug: coaches.slug,
        name: users.name,
        title: coaches.title,
        experienceYears: coaches.experienceYears,
        specialization: coaches.specialization,
        certifications: coaches.certifications,
        achievements: coaches.achievements,
        bio: coaches.bio,
        photoUrl: coaches.photoUrl,
      })
      .from(coaches)
      .innerJoin(users, eq(users.id, coaches.userId))
      .where(and(eq(coaches.isPublic, true), eq(users.isActive, true)))
      .orderBy(asc(coaches.sortOrder), asc(users.name)),
  ["public-coaches"],
  { tags: [TAGS.coaches], revalidate: REVALIDATE },
);

export type PublicCoach = Awaited<ReturnType<typeof getPublicCoaches>>[number];

export const getPrograms = unstable_cache(
  async () =>
    db
      .select({
        id: programs.id,
        slug: programs.slug,
        name: programs.name,
        level: programs.level,
        tagline: programs.tagline,
        description: programs.description,
        ageGroup: programs.ageGroup,
        frequency: programs.frequency,
        sessionDuration: programs.sessionDuration,
        programLength: programs.programLength,
        monthlyFee: programs.monthlyFee,
        highlights: programs.highlights,
        coachName: users.name,
        coachSlug: coaches.slug,
      })
      .from(programs)
      .leftJoin(coaches, eq(coaches.id, programs.coachId))
      .leftJoin(users, eq(users.id, coaches.userId))
      .where(eq(programs.isActive, true))
      .orderBy(asc(programs.sortOrder)),
  ["public-programs"],
  { tags: [TAGS.programs, TAGS.coaches], revalidate: REVALIDATE },
);

export type PublicProgram = Awaited<ReturnType<typeof getPrograms>>[number];

export const getMembershipPlans = unstable_cache(
  async () =>
    db
      .select({
        id: membershipPlans.id,
        slug: membershipPlans.slug,
        name: membershipPlans.name,
        description: membershipPlans.description,
        durationMonths: membershipPlans.durationMonths,
        price: membershipPlans.price,
        trainingAccess: membershipPlans.trainingAccess,
        benefits: membershipPlans.benefits,
        courtDiscountPercent: membershipPlans.courtDiscountPercent,
        isFeatured: membershipPlans.isFeatured,
      })
      .from(membershipPlans)
      .where(eq(membershipPlans.isActive, true))
      .orderBy(asc(membershipPlans.sortOrder)),
  ["public-plans"],
  { tags: [TAGS.plans], revalidate: REVALIDATE },
);

export type PublicPlan = Awaited<ReturnType<typeof getMembershipPlans>>[number];

const eventColumns = {
  id: events.id,
  slug: events.slug,
  name: events.name,
  category: events.category,
  summary: events.summary,
  description: events.description,
  date: events.date,
  endDate: events.endDate,
  startMinute: events.startMinute,
  endMinute: events.endMinute,
  venue: events.venue,
  fee: events.fee,
  registrationLimit: events.registrationLimit,
  registrationDeadline: events.registrationDeadline,
  divisions: events.divisions,
  status: events.status,
  format: events.format,
};

async function withRegistrationCounts<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, registered: 0 }));
  const counts = await db
    .select({ eventId: eventRegistrations.eventId, n: count() })
    .from(eventRegistrations)
    .where(and(inArray(eventRegistrations.eventId, rows.map((r) => r.id)), ne(eventRegistrations.status, "CANCELLED")))
    .groupBy(eventRegistrations.eventId);
  const map = new Map(counts.map((c) => [c.eventId, c.n]));
  return rows.map((r) => ({ ...r, registered: map.get(r.id) ?? 0 }));
}

export const getUpcomingEvents = unstable_cache(
  async (limit: number) => {
    const today = todayInTz();
    const rows = await db
      .select(eventColumns)
      .from(events)
      .where(and(eq(events.status, "PUBLISHED"), or(gte(events.date, today), gte(events.endDate, today))))
      .orderBy(asc(events.date))
      .limit(limit);
    return withRegistrationCounts(rows);
  },
  ["public-events-upcoming"],
  { tags: [TAGS.events], revalidate: REVALIDATE },
);

export const getPastEvents = unstable_cache(
  async () => {
    const today = todayInTz();
    return db
      .select(eventColumns)
      .from(events)
      .where(and(inArray(events.status, ["PUBLISHED", "COMPLETED"]), lte(events.date, today), or(isNull(events.endDate), lte(events.endDate, today))))
      .orderBy(desc(events.date))
      .limit(6);
  },
  ["public-events-past"],
  { tags: [TAGS.events], revalidate: REVALIDATE },
);

export type PublicEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

export const getEventBySlug = unstable_cache(
  async (slug: string) => {
    const rows = await db
      .select(eventColumns)
      .from(events)
      .where(and(eq(events.slug, slug), inArray(events.status, ["PUBLISHED", "COMPLETED", "CANCELLED"])))
      .limit(1);
    const [row] = await withRegistrationCounts(rows);
    return row ?? null;
  },
  ["public-event"],
  { tags: [TAGS.events], revalidate: 60 },
);

export const getWebsiteAnnouncements = unstable_cache(
  async () => {
    const now = new Date();
    const rows = await db
      .select({ id: announcements.id, title: announcements.title, body: announcements.body, isPinned: announcements.isPinned, publishedAt: announcements.publishedAt })
      .from(announcements)
      .where(
        and(
          eq(announcements.showOnWebsite, true),
          eq(announcements.audience, "EVERYONE"),
          lte(announcements.publishedAt, now),
          or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
        ),
      )
      .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt))
      .limit(3);
    return rows.map((r) => ({ ...r, publishedAt: r.publishedAt.toISOString() }));
  },
  ["public-announcements"],
  { tags: [TAGS.announcements], revalidate: 120 },
);

export const getCourtSummary = unstable_cache(
  async () => {
    const rows = await db
      .select({ id: courts.id, name: courts.name, status: courts.status, hourlyRate: courts.hourlyRate, peakHourlyRate: courts.peakHourlyRate })
      .from(courts)
      .where(ne(courts.status, "INACTIVE"))
      .orderBy(asc(courts.sortOrder));
    return {
      count: rows.length,
      fromRate: rows.length ? Math.min(...rows.map((r) => r.hourlyRate)) : 0,
      peakFromRate: rows.length ? Math.min(...rows.map((r) => r.peakHourlyRate)) : 0,
    };
  },
  ["public-court-summary"],
  { tags: [TAGS.courts], revalidate: REVALIDATE },
);
