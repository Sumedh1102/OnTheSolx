"use server";

import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { bookings, courtBlocks, courts } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { invalidate, TAGS } from "@/server/cache";
import { DomainError } from "@/server/errors";
import { getBookingSettings, saveSetting } from "@/server/settings";
import { hhmmToMinutes } from "@/lib/time";
import { isoDate, optionalText } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const rupees = z.coerce.number().min(0).max(100000).transform((v) => Math.round(v * 100));
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

const courtSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: optionalText(300),
    surface: z.string().trim().min(2).max(80),
    hourlyRate: rupees,
    peakHourlyRate: rupees,
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
    sortOrder: z.coerce.number().int().min(0).max(99),
  })
  .refine((v) => v.peakHourlyRate >= v.hourlyRate, { path: ["peakHourlyRate"], message: "Peak rate should be at least the non-peak rate" });

function refresh() {
  revalidatePath("/dashboard/courts");
  invalidate(TAGS.courts);
}

export async function createCourt(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("courts:manage");
    const input = courtSchema.parse(formObject(formData));
    const [row] = await db.insert(courts).values(input).returning({ id: courts.id });
    await audit(actor.id, "court.create", "court", row!.id, { name: input.name });
    refresh();
    return { ok: true, message: `${input.name} added` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCourt(courtId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("courts:manage");
    const input = courtSchema.parse(formObject(formData));
    await db.update(courts).set(input).where(eq(courts.id, courtId));
    await audit(actor.id, "court.update", "court", courtId, input);
    refresh();
    return { ok: true, message: `${input.name} saved` };
  } catch (err) {
    return toActionError(err);
  }
}

const blockSchema = z
  .object({
    courtId: z.string(),
    type: z.enum(["MAINTENANCE", "BLOCKED"]),
    startDate: isoDate,
    endDate: isoDate,
    wholeDay: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
    if (!v.wholeDay) {
      if (!v.startTime || !/^\d{2}:\d{2}$/.test(v.startTime)) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Choose a start time" });
      if (!v.endTime || !/^\d{2}:\d{2}$/.test(v.endTime)) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Choose an end time" });
      if (v.startTime && v.endTime && v.endTime <= v.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after start time" });
    }
  });

export async function addCourtBlock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("courts:manage");
    const input = blockSchema.parse(formObject(formData));
    const allCourts = input.courtId === "ALL";
    const courtIds = allCourts ? (await db.select({ id: courts.id }).from(courts)).map((c) => c.id) : [z.uuid().parse(input.courtId)];
    const startMinute = input.wholeDay ? null : hhmmToMinutes(input.startTime!);
    const endMinute = input.wholeDay ? null : hhmmToMinutes(input.endTime!);
    await db.insert(courtBlocks).values(
      courtIds.map((courtId) => ({ courtId, type: input.type, startDate: input.startDate, endDate: input.endDate, startMinute, endMinute, reason: input.reason, createdById: actor.id })),
    );
    const [{ n }] = (await db
      .select({ n: count() })
      .from(bookings)
      .where(
        and(
          inArray(bookings.courtId, courtIds),
          gte(bookings.date, input.startDate),
          lte(bookings.date, input.endDate),
          inArray(bookings.status, ["PAID", "CONFIRMED", "PENDING", "PAYMENT_INITIATED"]),
          startMinute !== null ? sql`${bookings.startMinute} < ${endMinute} AND ${bookings.endMinute} > ${startMinute}` : undefined,
        ),
      )) as [{ n: number }];
    await audit(actor.id, "court.block", "court", allCourts ? "ALL" : courtIds[0], { ...input });
    refresh();
    return {
      ok: true,
      message: n ? `Saved. ${n} existing booking(s) overlap this window — review them in Bookings.` : "Saved. Those slots are no longer bookable.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCourtBlock(blockId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("courts:manage");
    await db.delete(courtBlocks).where(eq(courtBlocks.id, blockId));
    await audit(actor.id, "court.unblock", "court_block", blockId);
    refresh();
    return { ok: true, message: "Block removed — slots are bookable again" };
  } catch (err) {
    return toActionError(err);
  }
}

const settingsSchema = z
  .object({
    openTime: hhmm,
    closeTime: hhmm,
    holdMinutes: z.coerce.number().int().min(5).max(60),
    advanceDays: z.coerce.number().int().min(1).max(90),
    cancellationCutoffHours: z.coerce.number().int().min(0).max(72),
    defaultDuration: z.coerce.number().int(),
    allowGuestBooking: z.string().optional(),
  })
  .refine((v) => v.closeTime > v.openTime, { path: ["closeTime"], message: "Closing must be after opening" });

export async function saveBookingRules(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("courts:manage");
    const input = settingsSchema.parse(formObject(formData));
    const durations = formData
      .getAll("durations")
      .map((v) => Number(v))
      .filter((v) => [30, 60, 90, 120].includes(v))
      .sort((a, b) => a - b);
    if (!durations.length) throw new DomainError("Pick at least one slot duration.");
    if (!durations.includes(input.defaultDuration)) throw new DomainError("The default duration must be one of the enabled durations.");

    const peakWindows = [0, 1, 2]
      .map((i) => ({
        label: String(formData.get(`peak_label_${i}`) ?? "").trim(),
        start: String(formData.get(`peak_start_${i}`) ?? ""),
        end: String(formData.get(`peak_end_${i}`) ?? ""),
        days: formData.getAll(`peak_days_${i}`).map(Number).filter((d) => d >= 0 && d <= 6),
      }))
      .filter((w) => /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end))
      .map((w) => {
        if (w.end <= w.start) throw new DomainError("Each peak window must end after it starts.");
        return { label: w.label || "Peak", startMinute: hhmmToMinutes(w.start), endMinute: hhmmToMinutes(w.end), days: w.days };
      });

    const current = await getBookingSettings();
    await saveSetting(
      "booking",
      {
        ...current,
        openMinute: hhmmToMinutes(input.openTime),
        closeMinute: hhmmToMinutes(input.closeTime),
        durations,
        defaultDuration: input.defaultDuration,
        peakWindows,
        holdMinutes: input.holdMinutes,
        advanceDays: input.advanceDays,
        cancellationCutoffHours: input.cancellationCutoffHours,
        allowGuestBooking: !!input.allowGuestBooking,
      },
      actor.id,
    );
    await audit(actor.id, "settings.booking", "settings", "booking");
    refresh();
    revalidatePath("/book");
    return { ok: true, message: "Booking rules & pricing windows saved" };
  } catch (err) {
    return toActionError(err);
  }
}
