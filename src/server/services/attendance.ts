import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db";
import { attendanceRecords, attendanceSessions, batchStudents, batches, students } from "@/server/db/schema";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { getSetting } from "@/server/settings";
import { dayOfWeek, nowMinutesInTz, todayInTz } from "@/lib/time";
import { QR_PREFIX } from "@/server/qr";

/** Get-or-create the attendance sheet for a batch on a date (unique per batch/date). */
export async function ensureSession(conn: DbOrTx, batchId: string, date: string, userId: string) {
  const [existing] = await conn.select().from(attendanceSessions).where(and(eq(attendanceSessions.batchId, batchId), eq(attendanceSessions.date, date))).limit(1);
  if (existing) return existing;
  try {
    const [created] = await conn.insert(attendanceSessions).values({ batchId, date, markedById: userId }).returning();
    return created!;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [row] = await conn.select().from(attendanceSessions).where(and(eq(attendanceSessions.batchId, batchId), eq(attendanceSessions.date, date))).limit(1);
    return row!;
  }
}

export type QrCheckInResult = {
  student: { id: string; name: string; studentCode: string; photoUrl: string | null };
  status: "PRESENT" | "LATE" | "ABSENT" | "LEAVE";
  alreadyMarked: boolean;
  markedAt: string;
  batchName: string;
};

/**
 * QR check-in: token → student → must be enrolled in the batch, which must run today.
 * The unique (session, student) index guarantees a student is never marked twice.
 */
export async function checkInByQr(input: { token: string; batchId: string; userId: string }): Promise<QrCheckInResult> {
  const settings = await getSetting("attendance");
  if (!settings.qrEnabled) throw new DomainError("QR check-in is turned off in settings.");
  const token = input.token.trim().replace(QR_PREFIX, "");
  if (!/^[A-Za-z0-9_-]{16,48}$/.test(token)) throw new DomainError("That isn't a SmashPoint student QR code.");

  const [student] = await db
    .select({ id: students.id, name: students.name, studentCode: students.studentCode, photoUrl: students.photoUrl, status: students.status })
    .from(students)
    .where(eq(students.qrToken, token))
    .limit(1);
  if (!student) throw new DomainError("QR code not recognised. It may have been replaced — ask the front desk.", "NOT_FOUND", 404);
  if (student.status !== "ACTIVE") throw new DomainError(`${student.name}'s profile is ${student.status.toLowerCase()}.`);

  const [batch] = await db.select().from(batches).where(eq(batches.id, input.batchId)).limit(1);
  if (!batch || !batch.isActive) throw new DomainError("Choose an active batch first.");
  const today = todayInTz();
  if (!batch.daysOfWeek.includes(dayOfWeek(today))) throw new DomainError(`${batch.name} doesn't run today.`);

  const [enrolment] = await db
    .select({ id: batchStudents.id })
    .from(batchStudents)
    .where(and(eq(batchStudents.batchId, batch.id), eq(batchStudents.studentId, student.id), eq(batchStudents.isActive, true)))
    .limit(1);
  if (!enrolment) throw new DomainError(`${student.name} isn't enrolled in ${batch.name}.`);

  const session = await ensureSession(db, batch.id, today, input.userId);
  const status = nowMinutesInTz() > batch.startMinute + settings.lateAfterMinutes ? "LATE" : "PRESENT";
  const inserted = await db
    .insert(attendanceRecords)
    .values({ sessionId: session.id, studentId: student.id, status, source: "QR", markedById: input.userId })
    .onConflictDoNothing({ target: [attendanceRecords.sessionId, attendanceRecords.studentId] })
    .returning();
  const { status: _s, ...publicStudent } = student;
  if (inserted[0]) {
    return { student: publicStudent, status: inserted[0].status, alreadyMarked: false, markedAt: inserted[0].markedAt.toISOString(), batchName: batch.name };
  }
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.studentId, student.id)))
    .limit(1);
  return { student: publicStudent, status: existing!.status, alreadyMarked: true, markedAt: existing!.markedAt.toISOString(), batchName: batch.name };
}
