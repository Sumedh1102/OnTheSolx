"use server";

import { and, count, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { batchStudents, batches, bookings } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { formatTimeRange } from "@/lib/format";
import { hhmmToMinutes, todayInTz } from "@/lib/time";
import { isoDate } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);

const batchSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    programId: optionalUuid,
    coachId: optionalUuid,
    courtId: optionalUuid,
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time"),
    capacity: z.coerce.number().int().min(1).max(60),
    monthlyFee: z.coerce.number().min(0).max(100000).transform((v) => Math.round(v * 100)),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "KIDS"]),
    startDate: isoDate,
    isActive: z.string().optional().transform((v) => v === "on"),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End time must be after start time" });

function parseDays(formData: FormData) {
  return [...new Set(formData.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
}

const NO_DAYS: ActionResult = { ok: false, error: "Pick at least one day.", fieldErrors: { days: ["Pick at least one day"] } };

async function checkCourtClash(input: { courtId: string | null; startMinute: number; endMinute: number; days: number[] }, excludeId?: string) {
  if (!input.courtId) return { futureBookings: 0 };
  const clash = await db
    .select({ name: batches.name, startMinute: batches.startMinute, endMinute: batches.endMinute })
    .from(batches)
    .where(
      and(
        eq(batches.courtId, input.courtId),
        eq(batches.isActive, true),
        excludeId ? ne(batches.id, excludeId) : undefined,
        sql`${batches.daysOfWeek} && ${sql.raw(`ARRAY[${input.days.join(",")}]::smallint[]`)}`,
        sql`${batches.startMinute} < ${input.endMinute} AND ${batches.endMinute} > ${input.startMinute}`,
      ),
    )
    .limit(1);
  if (clash[0]) throw new DomainError(`That court is already used by "${clash[0].name}" (${formatTimeRange(clash[0].startMinute, clash[0].endMinute)}) on one of those days.`);
  const [{ n }] = (await db
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.courtId, input.courtId),
        gte(bookings.date, todayInTz()),
        inArray(bookings.status, ["PAID", "CONFIRMED", "PENDING", "PAYMENT_INITIATED"]),
        sql`extract(dow from ${bookings.date})::int = ANY(${sql.raw(`ARRAY[${input.days.join(",")}]`)})`,
        sql`${bookings.startMinute} < ${input.endMinute} AND ${bookings.endMinute} > ${input.startMinute}`,
      ),
    )) as [{ n: number }];
  return { futureBookings: n };
}

export async function createBatch(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const actor = await assertPermission("batches:manage");
    const input = batchSchema.parse(formObject(formData));
    const days = parseDays(formData);
    if (!days.length) return NO_DAYS;
    const startMinute = hhmmToMinutes(input.startTime);
    const endMinute = hhmmToMinutes(input.endTime);
    await checkCourtClash({ courtId: input.courtId, startMinute, endMinute, days });
    const [row] = await db
      .insert(batches)
      .values({ name: input.name, programId: input.programId, coachId: input.coachId, courtId: input.courtId, daysOfWeek: days, startMinute, endMinute, capacity: input.capacity, monthlyFee: input.monthlyFee, level: input.level, startDate: input.startDate, isActive: true })
      .returning({ id: batches.id });
    id = row!.id;
    await audit(actor.id, "batch.create", "batch", id, { name: input.name });
    revalidatePath("/dashboard/batches");
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/dashboard/batches/${id}?created=1`);
}

export async function updateBatch(batchId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("batches:manage");
    const input = batchSchema.parse(formObject(formData));
    const days = parseDays(formData);
    if (!days.length) return NO_DAYS;
    const startMinute = hhmmToMinutes(input.startTime);
    const endMinute = hhmmToMinutes(input.endTime);
    const { futureBookings } = await checkCourtClash({ courtId: input.courtId, startMinute, endMinute, days }, batchId);
    const [{ enrolled }] = (await db
      .select({ enrolled: count() })
      .from(batchStudents)
      .where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.isActive, true)))) as [{ enrolled: number }];
    if (input.capacity < enrolled) throw new DomainError(`Capacity can't be below the ${enrolled} students already enrolled.`);
    await db
      .update(batches)
      .set({ name: input.name, programId: input.programId, coachId: input.coachId, courtId: input.courtId, daysOfWeek: days, startMinute, endMinute, capacity: input.capacity, monthlyFee: input.monthlyFee, level: input.level, startDate: input.startDate, isActive: input.isActive })
      .where(eq(batches.id, batchId));
    await audit(actor.id, "batch.update", "batch", batchId);
    revalidatePath(`/dashboard/batches/${batchId}`);
    return { ok: true, message: futureBookings ? `Saved. Note: ${futureBookings} upcoming court booking(s) overlap this schedule.` : "Batch saved" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function enrolStudentInBatch(batchId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("batches:manage");
    const studentId = z.uuid("Choose a student").parse(formData.get("studentId"));
    await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(batches).where(eq(batches.id, batchId)).for("update");
      if (!batch) throw new DomainError("Batch not found.");
      const [{ n }] = (await tx.select({ n: count() }).from(batchStudents).where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.isActive, true)))) as [{ n: number }];
      if (n >= batch.capacity) throw new DomainError(`${batch.name} is full.`, "CAPACITY_FULL");
      await tx
        .insert(batchStudents)
        .values({ batchId, studentId, joinedOn: todayInTz() })
        .onConflictDoUpdate({ target: [batchStudents.batchId, batchStudents.studentId], set: { isActive: true, joinedOn: todayInTz() } });
    });
    revalidatePath(`/dashboard/batches/${batchId}`);
    return { ok: true, message: "Student added" };
  } catch (err) {
    return toActionError(err);
  }
}
