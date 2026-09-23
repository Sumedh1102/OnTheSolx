import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { db } from "@/server/db";
import {
  attendanceRecords,
  attendanceSessions,
  batchStudents,
  batches,
  bookings,
  coaches,
  courts,
  enquiries,
  memberships,
  payments,
  students,
  users,
} from "@/server/db/schema";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking/engine";
import { addDays, dayOfWeek } from "@/lib/time";

const TZ = "Asia/Kolkata";
/** Local calendar date of an instant, evaluated in Postgres. */
const localDate = (col: unknown) => sql`(${col} AT TIME ZONE ${TZ})::date`;

export async function getAdminStats(today: string) {
  const [[todayBookings], [activeStudents], [activeMemberships], [todayRevenue], [todayAttendance], [newEnquiries]] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(and(eq(bookings.date, today), inArray(bookings.status, ["PAID", "CONFIRMED"]))),
    db.select({ n: count() }).from(students).where(eq(students.status, "ACTIVE")),
    db.select({ n: count() }).from(memberships).where(and(eq(memberships.status, "ACTIVE"), lte(memberships.startDate, today), gte(memberships.endDate, today))),
    db.select({ total: sum(payments.amount) }).from(payments).where(and(eq(payments.status, "PAID"), sql`${localDate(payments.paidAt)} = ${today}::date`)),
    db
      .select({ present: sql<number>`count(*) filter (where ${attendanceRecords.status} in ('PRESENT','LATE'))::int`, total: count() })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
      .where(eq(attendanceSessions.date, today)),
    db.select({ n: count() }).from(enquiries).where(eq(enquiries.status, "NEW")),
  ]);
  return {
    todayBookings: todayBookings?.n ?? 0,
    activeStudents: activeStudents?.n ?? 0,
    activeMemberships: activeMemberships?.n ?? 0,
    todayRevenue: Number(todayRevenue?.total ?? 0),
    todayPresent: todayAttendance?.present ?? 0,
    todayMarked: todayAttendance?.total ?? 0,
    newEnquiries: newEnquiries?.n ?? 0,
  };
}

export async function getBatchesOn(date: string, coachId?: string) {
  const dow = dayOfWeek(date);
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      startMinute: batches.startMinute,
      endMinute: batches.endMinute,
      daysOfWeek: batches.daysOfWeek,
      capacity: batches.capacity,
      level: batches.level,
      courtId: batches.courtId,
      courtName: courts.name,
      coachName: users.name,
      coachId: batches.coachId,
      enrolled: sql<number>`(select count(*)::int from ${batchStudents} where ${batchStudents.batchId} = ${batches.id} and ${batchStudents.isActive})`,
      marked: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id where s.batch_id = ${batches.id} and s.date = ${date}::date)`,
    })
    .from(batches)
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .leftJoin(coaches, eq(coaches.id, batches.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .where(and(eq(batches.isActive, true), sql`${dow} = ANY(${batches.daysOfWeek})`, coachId ? eq(batches.coachId, coachId) : undefined))
    .orderBy(asc(batches.startMinute));
  return rows;
}

export async function getCourtSchedule(date: string) {
  const [courtRows, dayBookings, dayBatches] = await Promise.all([
    db.select({ id: courts.id, name: courts.name, status: courts.status }).from(courts).orderBy(asc(courts.sortOrder)),
    db
      .select({ id: bookings.id, code: bookings.code, courtId: bookings.courtId, startMinute: bookings.startMinute, endMinute: bookings.endMinute, customerName: bookings.customerName, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.date, date), inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES])))
      .orderBy(asc(bookings.startMinute)),
    getBatchesOn(date),
  ]);
  return courtRows
    .filter((c) => c.status !== "INACTIVE")
    .map((c) => ({
      ...c,
      items: [
        ...dayBookings.filter((b) => b.courtId === c.id).map((b) => ({ kind: "booking" as const, id: b.id, label: b.customerName, sub: b.code, startMinute: b.startMinute, endMinute: b.endMinute, status: b.status })),
        ...dayBatches.filter((b) => b.courtId === c.id).map((b) => ({ kind: "batch" as const, id: b.id, label: b.name, sub: b.coachName ?? "", startMinute: b.startMinute, endMinute: b.endMinute, status: "TRAINING" })),
      ].sort((a, b) => a.startMinute - b.startMinute),
    }));
}

export async function getRecentBookings(limit = 8) {
  return db.query.bookings.findMany({ orderBy: [desc(bookings.createdAt)], limit, with: { court: { columns: { name: true } } } });
}

export async function getRecentPayments(limit = 8) {
  return db.select().from(payments).where(inArray(payments.status, ["PAID", "REFUNDED"])).orderBy(desc(payments.paidAt)).limit(limit);
}

export async function getRevenueSeries(today: string, days = 14) {
  const from = addDays(today, -(days - 1));
  const rows = await db
    .select({ day: sql<string>`to_char(${localDate(payments.paidAt)}, 'YYYY-MM-DD')`, total: sum(payments.amount) })
    .from(payments)
    .where(and(eq(payments.status, "PAID"), sql`${localDate(payments.paidAt)} >= ${from}::date`, sql`${localDate(payments.paidAt)} <= ${today}::date`))
    .groupBy(sql`1`);
  const map = new Map(rows.map((r) => [r.day, Number(r.total ?? 0)]));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { date: d, value: map.get(d) ?? 0 };
  });
}

export async function getAttendanceOverview(from: string, to: string) {
  const rows = await db
    .select({ status: attendanceRecords.status, n: count() })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .where(and(gte(attendanceSessions.date, from), lte(attendanceSessions.date, to)))
    .groupBy(attendanceRecords.status);
  const out = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function getExpiringMemberships(today: string, withinDays = 7) {
  return db
    .select({ id: memberships.id, endDate: memberships.endDate, studentName: students.name, studentId: students.id })
    .from(memberships)
    .innerJoin(students, eq(students.id, memberships.studentId))
    .where(and(eq(memberships.status, "ACTIVE"), gte(memberships.endDate, today), lte(memberships.endDate, addDays(today, withinDays))))
    .orderBy(asc(memberships.endDate))
    .limit(8);
}
