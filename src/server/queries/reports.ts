import "server-only";
import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  attendanceRecords,
  attendanceSessions,
  batchStudents,
  batches,
  bookings,
  coaches,
  courts,
  memberships,
  payments,
  students,
  users,
} from "@/server/db/schema";

const TZ = "Asia/Kolkata";
const paidLocalDate = sql`(${payments.paidAt} AT TIME ZONE ${TZ})::date`;

export type Period = "daily" | "weekly" | "monthly" | "yearly";
const TRUNC: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };

export async function revenueReport(from: string, to: string, period: Period) {
  const bucket = sql.raw(`'${TRUNC[period]}'`);
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${bucket}, ${paidLocalDate}), 'YYYY-MM-DD')`,
      purpose: payments.purpose,
      total: sql<number>`sum(${payments.amount})::bigint`,
      n: count(),
    })
    .from(payments)
    .where(and(eq(payments.status, "PAID"), sql`${paidLocalDate} between ${from}::date and ${to}::date`))
    .groupBy(sql`1`, payments.purpose)
    .orderBy(sql`1`);
  const map = new Map<string, { bucket: string; total: number; BOOKING: number; MEMBERSHIP: number; EVENT: number; other: number; count: number }>();
  for (const r of rows) {
    const e = map.get(r.bucket) ?? { bucket: r.bucket, total: 0, BOOKING: 0, MEMBERSHIP: 0, EVENT: 0, other: 0, count: 0 };
    const v = Number(r.total);
    e.total += v;
    e.count += r.n;
    if (r.purpose === "BOOKING" || r.purpose === "MEMBERSHIP" || r.purpose === "EVENT") e[r.purpose] += v;
    else e.other += v;
    map.set(r.bucket, e);
  }
  const series = [...map.values()];
  const [refunds] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.refundedAmount}), 0)::bigint` })
    .from(payments)
    .where(and(eq(payments.status, "REFUNDED"), sql`(${payments.refundedAt} AT TIME ZONE ${TZ})::date between ${from}::date and ${to}::date`));
  return {
    series,
    total: series.reduce((a, s) => a + s.total, 0),
    byPurpose: {
      BOOKING: series.reduce((a, s) => a + s.BOOKING, 0),
      MEMBERSHIP: series.reduce((a, s) => a + s.MEMBERSHIP, 0),
      EVENT: series.reduce((a, s) => a + s.EVENT, 0),
    },
    refunded: Number(refunds?.total ?? 0),
  };
}

export async function bookingReport(from: string, to: string) {
  const inRange = and(gte(bookings.date, from), lte(bookings.date, to));
  const [totals] = await db
    .select({
      total: sql<number>`count(*) filter (where ${bookings.status} <> 'EXPIRED')::int`,
      confirmed: sql<number>`count(*) filter (where ${bookings.status} in ('PAID','CONFIRMED'))::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} in ('CANCELLED','REFUNDED'))::int`,
      hours: sql<number>`coalesce(sum(${bookings.endMinute} - ${bookings.startMinute}) filter (where ${bookings.status} in ('PAID','CONFIRMED')), 0)::int`,
      online: sql<number>`count(*) filter (where ${bookings.source} = 'ONLINE' and ${bookings.status} in ('PAID','CONFIRMED'))::int`,
    })
    .from(bookings)
    .where(inRange);
  const byHour = await db
    .select({ hour: sql<number>`(${bookings.startMinute} / 60)::int`, n: count() })
    .from(bookings)
    .where(and(inRange, inArray(bookings.status, ["PAID", "CONFIRMED"])))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byCourt = await db
    .select({ court: courts.name, n: count(), minutes: sql<number>`sum(${bookings.endMinute} - ${bookings.startMinute})::int`, revenue: sql<number>`sum(${bookings.total})::bigint` })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .where(and(inRange, inArray(bookings.status, ["PAID", "CONFIRMED"])))
    .groupBy(courts.name, courts.sortOrder)
    .orderBy(asc(courts.sortOrder));
  const byWeekday = await db
    .select({ dow: sql<number>`extract(isodow from ${bookings.date})::int`, n: count() })
    .from(bookings)
    .where(and(inRange, inArray(bookings.status, ["PAID", "CONFIRMED"])))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const t = totals ?? { total: 0, confirmed: 0, cancelled: 0, hours: 0, online: 0 };
  const peak = [...byHour].sort((a, b) => b.n - a.n)[0];
  const top = [...byCourt].sort((a, b) => b.n - a.n)[0];
  return {
    total: t.total,
    confirmed: t.confirmed,
    cancelled: t.cancelled,
    cancellationRate: t.total ? Math.round((t.cancelled / t.total) * 1000) / 10 : 0,
    hoursBooked: Math.round(t.hours / 60),
    onlineShare: t.confirmed ? Math.round((t.online / t.confirmed) * 100) : 0,
    byHour: byHour.map((h) => ({ hour: h.hour, count: h.n })),
    byCourt: byCourt.map((c) => ({ court: c.court, count: c.n, hours: Math.round(c.minutes / 60), revenue: Number(c.revenue) })),
    byWeekday: byWeekday.map((d) => ({ dow: d.dow, count: d.n })),
    peakHour: peak?.hour ?? null,
    mostUsedCourt: top?.court ?? null,
  };
}

export async function studentReport(from: string, to: string, today: string) {
  const [[active], [newStudents], [expired], [activeMemberships], attendance] = await Promise.all([
    db.select({ n: count() }).from(students).where(eq(students.status, "ACTIVE")),
    db.select({ n: count() }).from(students).where(and(gte(students.joiningDate, from), lte(students.joiningDate, to))),
    db
      .select({ n: count() })
      .from(memberships)
      .where(
        and(
          gte(memberships.endDate, from),
          lte(memberships.endDate, to < today ? to : today),
          inArray(memberships.status, ["ACTIVE", "EXPIRED"]),
          sql`not exists (select 1 from ${memberships} m2 where m2.student_id = ${memberships.studentId} and m2.start_date > ${memberships.startDate} and m2.status = 'ACTIVE')`,
        ),
      ),
    db.select({ n: count() }).from(memberships).where(and(eq(memberships.status, "ACTIVE"), lte(memberships.startDate, today), gte(memberships.endDate, today))),
    db
      .select({ status: attendanceRecords.status, n: count() })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
      .where(and(gte(attendanceSessions.date, from), lte(attendanceSessions.date, to)))
      .groupBy(attendanceRecords.status),
  ]);
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const a of attendance) counts[a.status] = a.n;
  const denom = counts.PRESENT + counts.LATE + counts.ABSENT;
  const byLevel = await db.select({ level: students.level, n: count() }).from(students).where(eq(students.status, "ACTIVE")).groupBy(students.level);
  return {
    active: active?.n ?? 0,
    newStudents: newStudents?.n ?? 0,
    expiredMemberships: expired?.n ?? 0,
    activeMemberships: activeMemberships?.n ?? 0,
    attendance: counts,
    attendancePct: denom ? Math.round(((counts.PRESENT + counts.LATE) / denom) * 100) : 0,
    byLevel: byLevel.map((l) => ({ level: l.level, count: l.n })),
  };
}

export async function coachReport(from: string, to: string) {
  return db
    .select({
      id: coaches.id,
      name: users.name,
      title: coaches.title,
      sessions: sql<number>`(select count(*)::int from ${attendanceSessions} s join ${batches} b on b.id = s.batch_id where b.coach_id = ${coaches.id} and s.date between ${from}::date and ${to}::date)`,
      studentsAssigned: sql<number>`(select count(distinct bs.student_id)::int from ${batchStudents} bs join ${batches} b on b.id = bs.batch_id where b.coach_id = ${coaches.id} and bs.is_active)`,
      attendanceHandled: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id join ${batches} b on b.id = s.batch_id where b.coach_id = ${coaches.id} and s.date between ${from}::date and ${to}::date)`,
      attended: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id join ${batches} b on b.id = s.batch_id where b.coach_id = ${coaches.id} and s.date between ${from}::date and ${to}::date and ar.status in ('PRESENT','LATE'))`,
      counted: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id join ${batches} b on b.id = s.batch_id where b.coach_id = ${coaches.id} and s.date between ${from}::date and ${to}::date and ar.status <> 'LEAVE')`,
      batches: sql<number>`(select count(*)::int from ${batches} b where b.coach_id = ${coaches.id} and b.is_active)`,
    })
    .from(coaches)
    .innerJoin(users, eq(users.id, coaches.userId))
    .where(eq(users.isActive, true))
    .orderBy(asc(coaches.sortOrder));
}
