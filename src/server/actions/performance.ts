"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { performanceRecords, students } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { getCoachStudentIds } from "@/server/queries/coach";
import { getCoachForUser } from "@/server/queries/viewer";
import { notify } from "@/server/notifications";
import { todayInTz } from "@/lib/time";
import { isoDate } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const score = z.coerce.number().int().min(1).max(10);
const schema = z.object({
  assessedOn: isoDate,
  footwork: score,
  smash: score,
  drop: score,
  serve: score,
  defense: score,
  agility: score,
  stamina: score,
  matchPerformance: score,
  notes: z.string().trim().max(1000).optional(),
});

export async function addAssessment(studentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("performance:manage");
    const coach = await getCoachForUser(actor.id);
    if (actor.role === "COACH") {
      if (!coach || !(await getCoachStudentIds(coach.id)).includes(studentId)) throw new DomainError("You can only assess your own students.");
    }
    const input = schema.parse(formObject(formData));
    if (input.assessedOn > todayInTz()) throw new DomainError("Assessment date can't be in the future.");
    await db.insert(performanceRecords).values({ ...input, notes: input.notes || null, studentId, coachId: coach?.id ?? null });

    const [s] = await db.select({ userId: students.userId, name: students.name }).from(students).where(eq(students.id, studentId)).limit(1);
    if (s?.userId) {
      await notify({ userId: s.userId, type: "GENERAL", title: "New skill assessment", body: "Your coach added a new skill assessment. See your progress in the dashboard.", link: "/dashboard/attendance#performance", channels: [] });
    }
    revalidatePath(`/dashboard/performance/${studentId}`);
    return { ok: true, message: "Assessment saved" };
  } catch (err) {
    return toActionError(err);
  }
}
