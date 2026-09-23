import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { attendanceRecords, attendanceSessions, batchStudents, batches, courts, performanceRecords, students } from "@/server/db/schema";

export async function getCoachBatches(coachId: string) {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      daysOfWeek: batches.daysOfWeek,
      startMinute: batches.startMinute,
      endMinute: batches.endMinute,
      capacity: batches.capacity,
      isActive: batches.isActive,
      courtName: courts.name,
      enrolled: sql<number>`(select count(*)::int from ${batchStudents} where ${batchStudents.batchId} = ${batches.id} and ${batchStudents.isActive})`,
    })
    .from(batches)
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .where(and(eq(batches.coachId, coachId), eq(batches.isActive, true)))
    .orderBy(asc(batches.startMinute));
}

/** Students in any of the coach's batches, plus students whose primary coach they are. */
export async function getCoachStudentIds(coachId: string) {
  const rows = await db
    .selectDistinct({ id: batchStudents.studentId })
    .from(batchStudents)
    .innerJoin(batches, eq(batches.id, batchStudents.batchId))
    .where(and(eq(batches.coachId, coachId), eq(batchStudents.isActive, true)));
  const primary = await db.select({ id: students.id }).from(students).where(eq(students.coachId, coachId));
  return [...new Set([...rows.map((r) => r.id), ...primary.map((r) => r.id)])];
}

export async function getCoachStudentsWithScores(coachId: string) {
  const ids = await getCoachStudentIds(coachId);
  if (!ids.length) return [];
  const list = await db
    .select({ id: students.id, name: students.name, photoUrl: students.photoUrl, level: students.level, studentCode: students.studentCode })
    .from(students)
    .where(and(inArray(students.id, ids), eq(students.status, "ACTIVE")))
    .orderBy(asc(students.name));
  const latest = await db
    .select({
      studentId: performanceRecords.studentId,
      assessedOn: sql<string>`max(${performanceRecords.assessedOn})::text`,
    })
    .from(performanceRecords)
    .where(inArray(performanceRecords.studentId, ids))
    .groupBy(performanceRecords.studentId);
  const map = new Map(latest.map((l) => [l.studentId, l.assessedOn]));
  return list.map((s) => ({ ...s, lastAssessed: map.get(s.id) ?? null }));
}

export async function getCoachSessionStats(coachId: string, from: string, to: string) {
  const [sessions] = await db
    .select({ n: count() })
    .from(attendanceSessions)
    .innerJoin(batches, eq(batches.id, attendanceSessions.batchId))
    .where(and(eq(batches.coachId, coachId), gte(attendanceSessions.date, from), lte(attendanceSessions.date, to)));
  const [records] = await db
    .select({
      attended: sql<number>`count(*) filter (where ${attendanceRecords.status} in ('PRESENT','LATE'))::int`,
      counted: sql<number>`count(*) filter (where ${attendanceRecords.status} <> 'LEAVE')::int`,
      total: count(),
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .innerJoin(batches, eq(batches.id, attendanceSessions.batchId))
    .where(and(eq(batches.coachId, coachId), gte(attendanceSessions.date, from), lte(attendanceSessions.date, to)));
  return {
    sessions: sessions?.n ?? 0,
    records: records?.total ?? 0,
    attendancePct: records?.counted ? Math.round((records.attended / records.counted) * 100) : null,
  };
}

export async function getRecentClassNotes(coachId: string, limit = 5) {
  return db
    .select({ id: attendanceSessions.id, date: attendanceSessions.date, notes: attendanceSessions.notes, batchName: batches.name, batchId: batches.id })
    .from(attendanceSessions)
    .innerJoin(batches, eq(batches.id, attendanceSessions.batchId))
    .where(and(eq(batches.coachId, coachId), isNotNull(attendanceSessions.notes)))
    .orderBy(desc(attendanceSessions.date))
    .limit(limit);
}
