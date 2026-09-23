import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { courts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { errorResponse, json, readJson } from "@/server/http";
import { quoteBooking } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";
import { isoDate, uuid } from "@/lib/validation";

const schema = z.object({
  courtId: uuid,
  date: isoDate,
  startMinute: z.number().int().min(0).max(1439),
  duration: z.number().int().min(30).max(240),
  couponCode: z.string().trim().max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const input = schema.parse(await readJson(req));
    const [settings, user] = await Promise.all([getBookingSettings(), getCurrentUser()]);
    const [court] = await db.select().from(courts).where(eq(courts.id, input.courtId)).limit(1);
    if (!court) throw new DomainError("Court not found.", "NOT_FOUND", 404);
    const endMinute = input.startMinute + input.duration;
    if (input.startMinute < settings.openMinute || endMinute > settings.closeMinute) throw new DomainError("Outside operating hours.");
    const quote = await quoteBooking(db, { court, date: input.date, startMinute: input.startMinute, endMinute, userId: user?.id, couponCode: input.couponCode }, settings);
    return json(quote);
  } catch (err) {
    return errorResponse(err);
  }
}
