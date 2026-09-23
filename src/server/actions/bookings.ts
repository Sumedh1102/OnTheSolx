"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { bookings, payments } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { initiateBookingPayment, recordOfflinePayment } from "@/server/payments/service";
import { cancelBooking } from "@/server/services/booking-lifecycle";
import { createBooking, rescheduleBooking } from "@/server/services/bookings";
import { can } from "@/lib/rbac";
import { hhmmToMinutes } from "@/lib/time";
import { emailSchema, isoDate, nameSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const staffBookingSchema = z.object({
  courtId: z.uuid(),
  date: isoDate,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  duration: z.coerce.number().int().min(30).max(240),
  name: nameSchema,
  phone: phoneSchema,
  email: z.union([z.literal(""), emailSchema]).optional().transform((v) => v || null),
  payment: z.enum(["CASH", "UPI", "CARD", "LINK"]),
  source: z.enum(["WALK_IN", "ADMIN"]).default("WALK_IN"),
  notes: z.string().trim().max(300).optional(),
});

export async function staffCreateBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let bookingId: string;
  try {
    const actor = await assertPermission("bookings:manage");
    const input = staffBookingSchema.parse(formObject(formData));
    const booking = await createBooking({
      courtId: input.courtId,
      date: input.date,
      startMinute: hhmmToMinutes(input.startTime),
      duration: input.duration,
      customer: { name: input.name, phone: input.phone, email: input.email },
      source: input.source,
      notes: input.notes,
      actorId: actor.id,
      staff: true,
    });
    bookingId = booking.id;
    if (input.payment === "LINK") {
      await initiateBookingPayment(booking.code);
    } else {
      await recordOfflinePayment({
        purpose: "BOOKING",
        bookingId: booking.id,
        amount: booking.total,
        method: input.payment,
        payer: { name: input.name, email: input.email, phone: input.phone },
        actorId: actor.id,
      });
    }
    await audit(actor.id, "booking.create", "booking", booking.id, { code: booking.code, payment: input.payment });
    revalidatePath("/dashboard/bookings");
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/dashboard/bookings/${bookingId}?created=1`);
}

export async function staffCancelBooking(bookingId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("bookings:manage");
    const reason = z.string().trim().min(3, "Give a short reason").max(200).parse(formData.get("reason"));
    const refund = formData.get("refund") === "on";
    if (refund && !can(actor.role, "payments:refund")) throw new DomainError("Only managers and admins can issue refunds.");
    await cancelBooking(bookingId, { reason, actorId: actor.id, refund });
    await audit(actor.id, "booking.cancel", "booking", bookingId, { reason, refund });
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    return { ok: true, message: refund ? "Booking cancelled and refund issued" : "Booking cancelled" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function staffRescheduleBooking(bookingId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("bookings:manage");
    const input = z.object({ courtId: z.uuid(), date: isoDate, startTime: z.string().regex(/^\d{2}:\d{2}$/) }).parse(formObject(formData));
    await rescheduleBooking(bookingId, { courtId: input.courtId, date: input.date, startMinute: hhmmToMinutes(input.startTime) }, actor.id);
    await audit(actor.id, "booking.reschedule", "booking", bookingId, input);
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    return { ok: true, message: "Booking moved" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function staffRecordBookingPayment(bookingId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("payments:record");
    const method = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]).parse(formData.get("method"));
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new DomainError("Booking not found.");
    if (!["PENDING", "PAYMENT_INITIATED", "EXPIRED"].includes(booking.status)) throw new DomainError("This booking doesn't need a payment.");
    const [paid] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.bookingId, bookingId), eq(payments.status, "PAID"))).orderBy(desc(payments.createdAt)).limit(1);
    if (paid) throw new DomainError("A payment is already recorded.");
    await db
      .update(payments)
      .set({ status: "FAILED", failureReason: "Paid at desk" })
      .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ["CREATED", "INITIATED"])));
    await recordOfflinePayment({
      purpose: "BOOKING",
      bookingId,
      amount: booking.total,
      method,
      payer: { name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone },
      userId: booking.userId,
      actorId: actor.id,
    });
    await audit(actor.id, "booking.pay_offline", "booking", bookingId, { method });
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    return { ok: true, message: "Payment recorded — booking confirmed" };
  } catch (err) {
    return toActionError(err);
  }
}
