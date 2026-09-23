"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { attendanceRecords, attendanceSessions, batchStudents, batches } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { getCoachForUser } from "@/server/queries/viewer";
import { ensureSession } from "@/server/services/attendance";
import { dayOfWeek, todayInTz } from "@/lib/time";
import { isoDate } from "@/lib/validation";
import { toActionError, type ActionResult } from "./result";

const recordsSchema = z
  .array(
    z.object({
      studentId: z.uuid(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
      remarks: z.string().trim().max(200).optional(),
    }),
  )
  .max(100);

export async function saveAttendance(batchId: string, date: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("attendance:mark");
    isoDate.parse(date);
    if (date > todayInTz()) throw new DomainError("You can't mark attendance for a future date.");

    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw new DomainError("Batch not found.");
    if (actor.role === "COACH") {
      const coach = await getCoachForUser(actor.id);
      if (!coach || batch.coachId !== coach.id) throw new DomainError("You can only mark attendance for your own batches.");
    }
    if (!batch.daysOfWeek.includes(dayOfWeek(date))) throw new DomainError(`${batch.name} doesn't run on that day.`);

    const records = recordsSchema.parse(JSON.parse(String(formData.get("records") ?? "[]")));
    const notes = z.string().trim().max(1000).optional().parse(formData.get("notes") ?? undefined);
    if (!records.length) throw new DomainError("Mark at least one student.");

    const enrolled = await db
      .select({ studentId: batchStudents.studentId })
      .from(batchStudents)
      .where(and(eq(batchStudents.batchId, batchId), inArray(batchStudents.studentId, records.map((r) => r.studentId))));
    const allowed = new Set(enrolled.map((e) => e.studentId));
    if (records.some((r) => !allowed.has(r.studentId))) throw new DomainError("Some students aren't in this batch.");

    await db.transaction(async (tx) => {
      const session = await ensureSession(tx, batchId, date, actor.id);
      await tx.update(attendanceSessions).set({ notes: notes || null, markedById: actor.id }).where(eq(attendanceSessions.id, session.id));
      for (const r of records) {
        await tx
          .insert(attendanceRecords)
          .values({ sessionId: session.id, studentId: r.studentId, status: r.status, remarks: r.remarks || null, markedById: actor.id, source: "MANUAL" })
          .onConflictDoUpdate({
            target: [attendanceRecords.sessionId, attendanceRecords.studentId],
            set: { status: r.status, remarks: r.remarks || null, markedById: actor.id, markedAt: new Date() },
          });
      }
    });
    revalidatePath("/dashboard/attendance");
    revalidatePath(`/dashboard/attendance/${batchId}`);
    const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    return { ok: true, message: `Attendance saved — ${present}/${records.length} present` };
  } catch (err) {
    return toActionError(err);
  }
}
