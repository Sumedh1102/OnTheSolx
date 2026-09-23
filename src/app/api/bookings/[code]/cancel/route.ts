import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { cancelBooking } from "@/server/services/booking-lifecycle";
import { canCustomerCancel } from "@/server/services/bookings";
import { findAccessibleBooking } from "@/server/services/booking-access";
import { getBookingSettings } from "@/server/settings";

export async function POST(req: Request, ctx: RouteContext<"/api/bookings/[code]/cancel">) {
  try {
    assertSameOrigin(req);
    const { code } = await ctx.params;
    const body = (await readJson(req)) as { t?: string };
    const { booking } = await findAccessibleBooking(code, body.t);
    if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    const settings = await getBookingSettings();
    if (!canCustomerCancel(booking, settings)) {
      throw new DomainError(`Online cancellation closes ${settings.cancellationCutoffHours} hours before the slot. Please call the front desk.`);
    }
    await cancelBooking(booking.id, { reason: "Cancelled by customer", actorId: booking.userId, refund: true });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
