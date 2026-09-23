import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { attendanceRecords, attendanceSessions, batchStudents, batches, coaches, courts, programs, students, users } from "@/server/db/schema";

export async function listBatches(coachId?: string) {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      daysOfWeek: batches.daysOfWeek,
      startMinute: batches.startMinute,
      endMinute: batches.endMinute,
      capacity: batches.capacity,
      monthlyFee: batches.monthlyFee,
      level: batches.level,
      isActive: batches.isActive,
      courtName: courts.name,
      coachName: users.name,
      programName: programs.name,
      enrolled: sql<number>`(select count(*)::int from ${batchStudents} where ${batchStudents.batchId} = ${batches.id} and ${batchStudents.isActive})`,
    })
    .from(batches)
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .leftJoin(coaches, eq(coaches.id, batches.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .leftJoin(programs, eq(programs.id, batches.programId))
    .where(coachId ? eq(batches.coachId, coachId) : undefined)
    .orderBy(desc(batches.isActive), asc(batches.startMinute));
}

export async function getBatch(id: string) {
  const [row] = await db
    .select({ batch: batches, courtName: courts.name, coachName: users.name, programName: programs.name })
    .from(batches)
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .leftJoin(coaches, eq(coaches.id, batches.coachId))
    .leftJoin(users, eq(users.id, coaches.userId))
    .leftJoin(programs, eq(programs.id, batches.programId))
    .where(eq(batches.id, id))
    .limit(1);
  return row ?? null;
}

export async function getBatchRoster(batchId: string, since: string) {
  return db
    .select({
      id: students.id,
      name: students.name,
      studentCode: students.studentCode,
      photoUrl: students.photoUrl,
      level: students.level,
      joinedOn: batchStudents.joinedOn,
      attended: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id where s.batch_id = ${batchId} and ar.student_id = ${students.id} and ar.status in ('PRESENT','LATE') and s.date >= ${since}::date)`,
      counted: sql<number>`(select count(*)::int from ${attendanceRecords} ar join ${attendanceSessions} s on s.id = ar.session_id where s.batch_id = ${batchId} and ar.student_id = ${students.id} and ar.status <> 'LEAVE' and s.date >= ${since}::date)`,
    })
    .from(batchStudents)
    .innerJoin(students, eq(students.id, batchStudents.studentId))
    .where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.isActive, true)))
    .orderBy(asc(students.name));
}

export async function getBatchSessions(batchId: string, limit = 10) {
  return db
    .select({
      id: attendanceSessions.id,
      date: attendanceSessions.date,
      notes: attendanceSessions.notes,
      present: sql<number>`(select count(*)::int from ${attendanceRecords} ar where ar.session_id = ${attendanceSessions.id} and ar.status in ('PRESENT','LATE'))`,
      total: sql<number>`(select count(*)::int from ${attendanceRecords} ar where ar.session_id = ${attendanceSessions.id})`,
    })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.batchId, batchId))
    .orderBy(desc(attendanceSessions.date))
    .limit(limit);
}

export async function getProgramOptions() {
  return db.select({ id: programs.id, name: programs.name }).from(programs).orderBy(asc(programs.sortOrder));
}
