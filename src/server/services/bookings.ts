import "server-only";
import { and, arrayContains, asc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx, type Transaction } from "@/server/db";
import {
  batches,
  bookingEvents,
  bookings,
  courtBlocks,
  courts,
  memberships,
  membershipPlans,
  students,
  type Booking,
  type BookingStatus,
} from "@/server/db/schema";
import { ACTIVE_BOOKING_STATUSES, applyDiscount, computeAvailability, priceForRange } from "@/lib/booking/engine";
import type { BookingSettings } from "@/lib/settings-types";
import { addDays, dayOfWeek, isValidISODate, nowMinutesInTz, rangesOverlap, todayInTz } from "@/lib/time";
import { formatDate, formatTimeRange } from "@/lib/format";
import { getBookingSettings } from "@/server/settings";
import { DomainError, isExclusionViolation, isUniqueViolation } from "@/server/errors";
import { randomCode } from "@/server/security";
import { resolveCoupon } from "./coupons";

/* ────────────────────────────────────────────────────────────────────────── */
/* Availability                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Active = currently occupying the slot. Unpaid holds stop counting once they expire. */
function occupyingBookingFilter(now = new Date()) {
  return or(
    inArray(bookings.status, ["PAID", "CONFIRMED"]),
    and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, now))),
  );
}

function nowMinuteFor(date: string, settings: BookingSettings): number | null {
  const today = todayInTz(settings.timezone);
  if (date < today) return Number.POSITIVE_INFINITY;
  if (date === today) return nowMinutesInTz(settings.timezone);
  return null;
}

async function loadDayOccupancy(conn: DbOrTx, date: string, opts: { courtId?: string; excludeBookingId?: string } = {}) {
  const dow = dayOfWeek(date);
  const [dayBookings, dayBlocks, dayBatches] = await Promise.all([
    conn
      .select({ id: bookings.id, courtId: bookings.courtId, startMinute: bookings.startMinute, endMinute: bookings.endMinute })
      .from(bookings)
      .where(
        and(
          eq(bookings.date, date),
          occupyingBookingFilter(),
          opts.courtId ? eq(bookings.courtId, opts.courtId) : undefined,
          opts.excludeBookingId ? ne(bookings.id, opts.excludeBookingId) : undefined,
        ),
      ),
    conn
      .select({
        courtId: courtBlocks.courtId,
        type: courtBlocks.type,
        startMinute: courtBlocks.startMinute,
        endMinute: courtBlocks.endMinute,
        reason: courtBlocks.reason,
      })
      .from(courtBlocks)
      .where(
        and(lte(courtBlocks.startDate, date), gte(courtBlocks.endDate, date), opts.courtId ? eq(courtBlocks.courtId, opts.courtId) : undefined),
      ),
    conn
      .select({ courtId: batches.courtId, startMinute: batches.startMinute, endMinute: batches.endMinute, name: batches.name })
      .from(batches)
      .where(
        and(
          eq(batches.isActive, true),
          lte(batches.startDate, date),
          arrayContains(batches.daysOfWeek, [dow]),
          opts.courtId ? eq(batches.courtId, opts.courtId) : sql`${batches.courtId} IS NOT NULL`,
        ),
      ),
  ]);

  return {
    bookings: dayBookings,
    blocks: dayBlocks,
    training: dayBatches
      .filter((b): b is typeof b & { courtId: string } => !!b.courtId)
      .map((b) => ({ courtId: b.courtId, startMinute: b.startMinute, endMinute: b.endMinute, label: b.name })),
  };
}

export async function getAvailability(date: string, duration: number) {
  const settings = await getBookingSettings();
  if (!isValidISODate(date)) throw new DomainError("Invalid date.");
  if (!settings.durations.includes(duration)) duration = settings.defaultDuration;

  const [courtRows, occupancy] = await Promise.all([
    db
      .select({ id: courts.id, name: courts.name, status: courts.status, hourlyRate: courts.hourlyRate, peakHourlyRate: courts.peakHourlyRate })
      .from(courts)
      .orderBy(asc(courts.sortOrder), asc(courts.name)),
    loadDayOccupancy(db, date),
  ]);

  return computeAvailability({
    date,
    duration,
    settings,
    courts: courtRows,
    bookings: occupancy.bookings,
    blocks: occupancy.blocks,
    training: occupancy.training,
    nowMinute: nowMinuteFor(date, settings),
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Quotes                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type BookingQuote = {
  subtotal: number;
  memberDiscount: number;
  couponDiscount: number;
  discount: number;
  total: number;
  isPeak: boolean;
  couponId: string | null;
  couponMessage: string | null;
};

async function memberCourtDiscountPercent(conn: DbOrTx, userId: string | null | undefined, date: string): Promise<number> {
  if (!userId) return 0;
  const [row] = await conn
    .select({ pct: membershipPlans.courtDiscountPercent })
    .from(memberships)
    .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
    .innerJoin(students, eq(students.id, memberships.studentId))
    .where(
      and(
        eq(students.userId, userId),
        eq(memberships.status, "ACTIVE"),
        lte(memberships.startDate, date),
        gte(memberships.endDate, date),
      ),
    )
    .orderBy(sql`${membershipPlans.courtDiscountPercent} DESC`)
    .limit(1);
  return row?.pct ?? 0;
}

export async function quoteBooking(
  conn: DbOrTx,
  input: { court: { hourlyRate: number; peakHourlyRate: number }; date: string; startMinute: number; endMinute: number; userId?: string | null; couponCode?: string | null },
  settings: BookingSettings,
): Promise<BookingQuote> {
  const { price, isPeak } = priceForRange(input.court, settings.peakWindows, input.date, input.startMinute, input.endMinute);
  const pct = await memberCourtDiscountPercent(conn, input.userId, input.date);
  const member = applyDiscount(price, pct ? { type: "PERCENT", value: pct } : null);

  let couponDiscount = 0;
  let couponId: string | null = null;
  let couponMessage: string | null = null;
  if (input.couponCode?.trim()) {
    const result = await resolveCoupon(conn, input.couponCode, "BOOKING", member.total, input.date);
    if (result.ok) {
      const applied = applyDiscount(member.total, result.coupon);
      couponDiscount = applied.discount;
      couponId = result.coupon.id;
      couponMessage = `${result.coupon.code} applied`;
    } else {
      couponMessage = result.message;
    }
  }
  const discount = member.discount + couponDiscount;
  return {
    subtotal: price,
    memberDiscount: member.discount,
    couponDiscount,
    discount,
    total: price - discount,
    isPeak,
    couponId,
    couponMessage,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Lifecycle helpers                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export async function transitionBooking(
  tx: DbOrTx,
  bookingId: string,
  status: BookingStatus,
  opts: { note?: string; actorId?: string | null; patch?: Partial<typeof bookings.$inferInsert> } = {},
) {
  const [updated] = await tx
    .update(bookings)
    .set({ status, ...opts.patch })
    .where(eq(bookings.id, bookingId))
    .returning();
  await tx.insert(bookingEvents).values({ bookingId, status, note: opts.note ?? null, actorId: opts.actorId ?? null });
  return updated!;
}

/** Releases unpaid holds whose timer ran out (optionally only for one court/date). */
export async function expireStaleHolds(conn: DbOrTx, scope: { courtId?: string; date?: string } = {}) {
  const expired = await conn
    .update(bookings)
    .set({ status: "EXPIRED" })
    .where(
      and(
        inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]),
        lt(bookings.holdExpiresAt, new Date()),
        scope.courtId ? eq(bookings.courtId, scope.courtId) : undefined,
        scope.date ? eq(bookings.date, scope.date) : undefined,
      ),
    )
    .returning({ id: bookings.id });
  if (expired.length) {
    await conn.insert(bookingEvents).values(expired.map((b) => ({ bookingId: b.id, status: "EXPIRED" as const, note: "Payment window elapsed" })));
  }
  return expired.length;
}

/**
 * Server-side availability check for a single range. Must run inside a transaction that
 * holds the court row lock (see lockCourt) to be race-free.
 */
async function assertSlotFree(
  tx: Transaction,
  input: { courtId: string; date: string; startMinute: number; endMinute: number; excludeBookingId?: string },
) {
  const occupancy = await loadDayOccupancy(tx, input.date, { courtId: input.courtId, excludeBookingId: input.excludeBookingId });
  const overlaps = (r: { startMinute: number | null; endMinute: number | null }) =>
    r.startMinute === null || r.endMinute === null || rangesOverlap(input.startMinute, input.endMinute, r.startMinute, r.endMinute);

  const block = occupancy.blocks.find(overlaps);
  if (block) {
    throw new DomainError(
      block.type === "MAINTENANCE" ? "This court is under maintenance for the selected time." : "This slot has been blocked by the academy.",
      "SLOT_UNAVAILABLE",
      409,
    );
  }
  if (occupancy.training.some(overlaps)) {
    throw new DomainError("This court is reserved for a training batch at that time.", "SLOT_UNAVAILABLE", 409);
  }
  if (occupancy.bookings.some(overlaps)) {
    throw new DomainError("Sorry — that slot was just booked by someone else. Please pick another.", "SLOT_UNAVAILABLE", 409);
  }
}

async function lockCourt(tx: Transaction, courtId: string) {
  const [court] = await tx.select().from(courts).where(eq(courts.id, courtId)).for("update");
  if (!court) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  if (court.status !== "ACTIVE") throw new DomainError(`${court.name} is currently unavailable for booking.`, "SLOT_UNAVAILABLE", 409);
  return court;
}

function validateTimeWindow(
  settings: BookingSettings,
  input: { date: string; startMinute: number; endMinute: number },
  opts: { staff: boolean },
) {
  const today = todayInTz(settings.timezone);
  if (!isValidISODate(input.date)) throw new DomainError("Please choose a valid date.");
  if (input.date < today) throw new DomainError("You can't book a date in the past.");
  if (!opts.staff && input.date > addDays(today, settings.advanceDays)) {
    throw new DomainError(`Bookings open ${settings.advanceDays} days in advance.`);
  }
  if (input.startMinute < settings.openMinute || input.endMinute > settings.closeMinute) {
    throw new DomainError("That time is outside operating hours.");
  }
  if (input.startMinute % 30 !== 0 || input.endMinute % 30 !== 0) {
    throw new DomainError("Bookings start on the hour or half hour.");
  }
  if (input.date === today && input.startMinute <= nowMinutesInTz(settings.timezone)) {
    throw new DomainError("That slot has already started.");
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Create                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type CreateBookingInput = {
  courtId: string;
  date: string;
  startMinute: number;
  duration: number;
  customer: { name: string; phone: string; email?: string | null };
  userId?: string | null;
  couponCode?: string | null;
  notes?: string | null;
  source?: "ONLINE" | "WALK_IN" | "ADMIN";
  actorId?: string | null;
  /** Staff bookings may skip the advance-window limit and custom durations. */
  staff?: boolean;
};

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const settings = await getBookingSettings();
  const staff = !!input.staff;
  if (!staff && !settings.durations.includes(input.duration)) throw new DomainError("Unsupported slot duration.");
  if (input.duration < 30 || input.duration > 240) throw new DomainError("Unsupported slot duration.");

  const endMinute = input.startMinute + input.duration;
  validateTimeWindow(settings, { date: input.date, startMinute: input.startMinute, endMinute }, { staff });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const court = await lockCourt(tx, input.courtId);
        await expireStaleHolds(tx, { courtId: court.id, date: input.date });
        await assertSlotFree(tx, { courtId: court.id, date: input.date, startMinute: input.startMinute, endMinute });

        const quote = await quoteBooking(
          tx,
          { court, date: input.date, startMinute: input.startMinute, endMinute, userId: input.userId, couponCode: input.couponCode },
          settings,
        );
        if (input.couponCode?.trim() && !quote.couponId) throw new DomainError(quote.couponMessage ?? "Invalid coupon.");

        const [booking] = await tx
          .insert(bookings)
          .values({
            code: randomCode("SP"),
            courtId: court.id,
            userId: input.userId ?? null,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email || null,
            date: input.date,
            startMinute: input.startMinute,
            endMinute,
            subtotal: quote.subtotal,
            discount: quote.discount,
            total: quote.total,
            couponId: quote.couponId,
            status: "PENDING",
            source: input.source ?? "ONLINE",
            notes: input.notes || null,
            holdExpiresAt: new Date(Date.now() + settings.holdMinutes * 60_000),
            createdById: input.actorId ?? input.userId ?? null,
          })
          .returning();

        await tx.insert(bookingEvents).values({
          bookingId: booking!.id,
          status: "PENDING",
          note: `${court.name} · ${formatDate(input.date)} · ${formatTimeRange(input.startMinute, endMinute)}`,
          actorId: input.actorId ?? input.userId ?? null,
        });
        return booking!;
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new DomainError("Sorry — that slot was just booked by someone else. Please pick another.", "SLOT_UNAVAILABLE", 409);
      }
      // Extremely unlikely booking-code collision: retry with a fresh code.
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new DomainError("Could not create booking, please try again.");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cancel & reschedule                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function canCustomerCancel(booking: Pick<Booking, "date" | "startMinute" | "status">, settings: BookingSettings) {
  if (!["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(booking.status)) return false;
  const today = todayInTz(settings.timezone);
  const minutesUntilStart =
    (new Date(`${booking.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 60_000 +
    booking.startMinute -
    nowMinutesInTz(settings.timezone);
  return minutesUntilStart >= settings.cancellationCutoffHours * 60;
}

export async function rescheduleBooking(
  bookingId: string,
  target: { courtId: string; date: string; startMinute: number },
  actorId: string,
) {
  const settings = await getBookingSettings();
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!existing) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(existing.status)) {
    throw new DomainError("Only active bookings can be rescheduled.");
  }
  const duration = existing.endMinute - existing.startMinute;
  const endMinute = target.startMinute + duration;
  validateTimeWindow(settings, { date: target.date, startMinute: target.startMinute, endMinute }, { staff: true });

  try {
    return await db.transaction(async (tx) => {
      const court = await lockCourt(tx, target.courtId);
      await expireStaleHolds(tx, { courtId: court.id, date: target.date });
      await assertSlotFree(tx, { courtId: court.id, date: target.date, startMinute: target.startMinute, endMinute, excludeBookingId: bookingId });
      const [updated] = await tx
        .update(bookings)
        .set({ courtId: court.id, date: target.date, startMinute: target.startMinute, endMinute, reminderSentAt: null })
        .where(eq(bookings.id, bookingId))
        .returning();
      await tx.insert(bookingEvents).values({
        bookingId,
        status: updated!.status,
        note: `Rescheduled to ${court.name} · ${formatDate(target.date)} · ${formatTimeRange(target.startMinute, endMinute)}`,
        actorId,
      });
      return updated!;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("That slot is already booked.", "SLOT_UNAVAILABLE", 409);
    throw err;
  }
}
