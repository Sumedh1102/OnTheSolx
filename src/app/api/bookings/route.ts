import { bookingRequestSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { bookingReceiptPath, initiateBookingPayment } from "@/server/payments/service";
import { rateLimit } from "@/server/security";
import { createBooking } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";

/** Creates a booking hold (Pending) and immediately starts checkout (Payment Initiated). */
export async function POST(req: Request) {
  let code: string | undefined;
  try {
    assertSameOrigin(req);
    if (!rateLimit(`booking:${clientIp(req)}`, 20, 10 * 60_000).ok) throw new DomainError("Too many booking attempts. Please wait a few minutes.", "INVALID_INPUT", 429);

    const input = bookingRequestSchema.parse(await readJson(req));
    const [user, settings] = await Promise.all([getCurrentUser(), getBookingSettings()]);
    if (!user && !settings.allowGuestBooking) throw new DomainError("Please sign in to book a court.", "FORBIDDEN", 401);

    const booking = await createBooking({
      courtId: input.courtId,
      date: input.date,
      startMinute: input.startMinute,
      duration: input.duration,
      customer: { name: input.name, phone: input.phone, email: input.email },
      userId: user?.id ?? null,
      couponCode: input.couponCode,
      notes: input.notes,
      source: "ONLINE",
    });
    code = booking.code;
    const { checkout } = await initiateBookingPayment(booking.code);
    return json({ code: booking.code, total: booking.total, receiptUrl: bookingReceiptPath(booking.code), checkout }, { status: 201 });
  } catch (err) {
    return errorResponse(err, code ? { code, receiptUrl: bookingReceiptPath(code) } : undefined);
  }
}
