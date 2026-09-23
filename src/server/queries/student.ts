import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
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
  membershipPlans,
  payments,
  performanceRecords,
  students,
  users,
} from "@/server/db/schema";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking/engine";
import { endOfMonth, startOfMonth } from "@/lib/time";

export async function getStudentProfile(studentId: string) {
  const [row] = await db
    .select({
      student: students,
      coachName: users.name,
    })
    .from(students)
    .leftJoin(coaches, eq(coaches.id, students.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .where(eq(students.id, studentId))
    .limit(1);
  return row ?? null;
}

export async function getStudentBatches(studentId: string) {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      daysOfWeek: batches.daysOfWeek,
      startMinute: batches.startMinute,
      endMinute: batches.endMinute,
      isActive: batches.isActive,
      level: batches.level,
      courtName: courts.name,
      coachName: users.name,
    })
    .from(batchStudents)
    .innerJoin(batches, eq(batches.id, batchStudents.batchId))
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .leftJoin(coaches, eq(coaches.id, batches.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .where(and(eq(batchStudents.studentId, studentId), eq(batchStudents.isActive, true), eq(batches.isActive, true)))
    .orderBy(asc(batches.startMinute));
}

/** Current membership (active today or the next upcoming), plus the latest expired one. */
export async function getStudentMemberships(studentId: string) {
  return db
    .select({
      id: memberships.id,
      startDate: memberships.startDate,
      endDate: memberships.endDate,
      status: memberships.status,
      paymentStatus: memberships.paymentStatus,
      price: memberships.price,
      planId: membershipPlans.id,
      planName: membershipPlans.name,
      planSlug: membershipPlans.slug,
      trainingAccess: membershipPlans.trainingAccess,
      courtDiscountPercent: membershipPlans.courtDiscountPercent,
    })
    .from(memberships)
    .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
    .where(eq(memberships.studentId, studentId))
    .orderBy(desc(memberships.endDate));
}

export function pickCurrentMembership<T extends { status: string; startDate: string; endDate: string }>(rows: T[], today: string) {
  return (
    rows.find((m) => m.status === "ACTIVE" && m.startDate <= today && m.endDate >= today) ??
    rows.find((m) => m.status === "ACTIVE" && m.startDate > today) ??
    rows.find((m) => m.status !== "CANCELLED") ??
    null
  );
}

export type AttendanceCounts = { PRESENT: number; ABSENT: number; LATE: number; LEAVE: number };

export async function getAttendanceCounts(studentId: string, from?: string, to?: string): Promise<AttendanceCounts> {
  const rows = await db
    .select({ status: attendanceRecords.status, n: count() })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .where(
      and(eq(attendanceRecords.studentId, studentId), from ? gte(attendanceSessions.date, from) : undefined, to ? lte(attendanceSessions.date, to) : undefined),
    )
    .groupBy(attendanceRecords.status);
  const out: AttendanceCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

/** Attendance % counts Present and Late as attended; Leave is excluded from the denominator. */
export function attendancePercent(c: AttendanceCounts) {
  const denom = c.PRESENT + c.LATE + c.ABSENT;
  return denom ? Math.round(((c.PRESENT + c.LATE) / denom) * 100) : 0;
}

export async function getMonthlyAttendance(studentId: string, months = 6) {
  const rows = await db
    .select({
      month: sql<string>`to_char(${attendanceSessions.date}, 'YYYY-MM')`,
      status: attendanceRecords.status,
      n: count(),
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .where(and(eq(attendanceRecords.studentId, studentId), gte(attendanceSessions.date, sql`(current_date - ${months * 31}::int)`)))
    .groupBy(sql`1`, attendanceRecords.status)
    .orderBy(sql`1`);
  const map = new Map<string, AttendanceCounts>();
  for (const r of rows) {
    const m = map.get(r.month) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    m[r.status] = r.n;
    map.set(r.month, m);
  }
  return [...map.entries()].map(([month, counts]) => ({ month, counts, percent: attendancePercent(counts) }));
}

export async function getAttendanceLog(studentId: string, month: string) {
  return db
    .select({
      date: attendanceSessions.date,
      status: attendanceRecords.status,
      source: attendanceRecords.source,
      markedAt: attendanceRecords.markedAt,
      batchName: batches.name,
      remarks: attendanceRecords.remarks,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .innerJoin(batches, eq(batches.id, attendanceSessions.batchId))
    .where(and(eq(attendanceRecords.studentId, studentId), gte(attendanceSessions.date, startOfMonth(month)), lte(attendanceSessions.date, endOfMonth(month))))
    .orderBy(desc(attendanceSessions.date));
}

export async function getUserBookings(userId: string, opts: { upcoming?: boolean; today: string; limit?: number }) {
  return db.query.bookings.findMany({
    where: opts.upcoming
      ? and(eq(bookings.userId, userId), gte(bookings.date, opts.today), inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]))
      : eq(bookings.userId, userId),
    with: { court: { columns: { name: true } } },
    orderBy: opts.upcoming ? [asc(bookings.date), asc(bookings.startMinute)] : [desc(bookings.date), desc(bookings.startMinute)],
    limit: opts.limit ?? 50,
  });
}

export async function getPaymentsFor(opts: { userId?: string; studentIds: string[] }, limit = 10) {
  const owner = or(opts.userId ? eq(payments.userId, opts.userId) : undefined, opts.studentIds.length ? inArray(payments.studentId, opts.studentIds) : undefined);
  if (!owner) return [];
  return db
    .select()
    .from(payments)
    .where(and(owner, inArray(payments.status, ["PAID", "REFUNDED"])))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function getPerformanceHistory(studentId: string) {
  return db
    .select({ record: performanceRecords, coachName: users.name })
    .from(performanceRecords)
    .leftJoin(coaches, eq(coaches.id, performanceRecords.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .where(eq(performanceRecords.studentId, studentId))
    .orderBy(asc(performanceRecords.assessedOn));
}

export { SKILLS, type SkillKey } from "@/lib/skills";
