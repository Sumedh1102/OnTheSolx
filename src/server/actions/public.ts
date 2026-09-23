"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { enquiries, eventRegistrations, events } from "@/server/db/schema";
import { enquirySchema, eventRegistrationSchema } from "@/lib/validation";
import { todayInTz } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { rateLimit } from "@/server/security";
import { getCurrentUser } from "@/server/auth/guards";
import { notify } from "@/server/notifications";
import { startPayment } from "@/server/payments/service";
import type { CheckoutInstruction } from "@/server/payments/types";
import { invalidate, TAGS } from "@/server/cache";
import { formObject, toActionError, type ActionResult } from "./result";

async function clientKey(prefix: string) {
  const h = await headers();
  return `${prefix}:${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local"}`;
}

export async function submitEnquiry(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const input = enquirySchema.parse(formObject(formData));
    if (!rateLimit(await clientKey("enquiry"), 5, 60 * 60_000).ok) throw new DomainError("Too many messages — please try again later.");
    await db.insert(enquiries).values({ name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message });
    return { ok: true, message: "Thanks! Our front desk will get back to you within a few hours." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function registerForEvent(
  _prev: ActionResult<{ checkout?: CheckoutInstruction }> | null,
  formData: FormData,
): Promise<ActionResult<{ checkout?: CheckoutInstruction }>> {
  try {
    const input = eventRegistrationSchema.parse(formObject(formData));
    if (!rateLimit(await clientKey("event-reg"), 10, 60 * 60_000).ok) throw new DomainError("Too many attempts — please try again later.");
    const user = await getCurrentUser();

    const { registration, event } = await db.transaction(async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("update");
      if (!event || event.status !== "PUBLISHED") throw new DomainError("Registrations for this event are closed.");
      const today = todayInTz();
      if ((event.endDate ?? event.date) < today) throw new DomainError("This event has already taken place.");
      if (event.registrationDeadline && today > event.registrationDeadline) throw new DomainError("The registration deadline has passed.");
      if (event.divisions.length && input.division && !event.divisions.includes(input.division)) throw new DomainError("Please choose a valid category.");

      let status: "PENDING" | "CONFIRMED" | "WAITLISTED" = event.fee > 0 ? "PENDING" : "CONFIRMED";
      if (event.registrationLimit) {
        const [{ n }] = (await tx
          .select({ n: count() })
          .from(eventRegistrations)
          .where(and(eq(eventRegistrations.eventId, event.id), ne(eventRegistrations.status, "CANCELLED")))) as [{ n: number }];
        if (n >= event.registrationLimit) status = "WAITLISTED";
      }
      const [registration] = await tx
        .insert(eventRegistrations)
        .values({
          eventId: event.id,
          userId: user?.id ?? null,
          participantName: input.participantName,
          email: input.email,
          phone: input.phone,
          division: input.division,
          status,
          amount: event.fee,
        })
        .returning();
      return { registration: registration!, event };
    });

    invalidate(TAGS.events);

    if (registration.status === "WAITLISTED") {
      return { ok: true, message: "This event is full — you're on the waitlist. We'll contact you if a spot opens up." };
    }
    if (event.fee > 0) {
      const { checkout } = await startPayment({
        purpose: "EVENT",
        amount: event.fee,
        description: `${event.name} registration`,
        payer: { name: input.participantName, email: input.email, phone: input.phone },
        userId: user?.id,
        eventRegistrationId: registration.id,
      });
      return { ok: true, message: "Redirecting to payment…", data: { checkout } };
    }
    await notify({
      userId: user?.id,
      recipient: { name: input.participantName, email: input.email, phone: input.phone },
      type: "EVENT",
      title: `You're registered · ${event.name}`,
      body: `See you on ${formatDate(event.date, "long")}. Please arrive 20 minutes early for check-in.`,
      link: `/events/${event.slug}`,
    });
    return { ok: true, message: `You're in! Confirmation sent to ${input.email}.` };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "This participant is already registered with that email." };
    return toActionError(err);
  }
}
