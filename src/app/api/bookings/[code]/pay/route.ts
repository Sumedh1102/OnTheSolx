import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { initiateBookingPayment } from "@/server/payments/service";
import { findAccessibleBooking } from "@/server/services/booking-access";

export async function POST(req: Request, ctx: RouteContext<"/api/bookings/[code]/pay">) {
  try {
    assertSameOrigin(req);
    const { code } = await ctx.params;
    const body = (await readJson(req)) as { t?: string };
    const { booking } = await findAccessibleBooking(code, body.t);
    if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    const { checkout } = await initiateBookingPayment(booking.code);
    return json({ checkout });
  } catch (err) {
    return errorResponse(err);
  }
}
