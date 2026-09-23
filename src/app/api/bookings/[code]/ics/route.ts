import type { NextRequest } from "next/server";
import { findAccessibleBooking } from "@/server/services/booking-access";
import { site } from "@/content/site";

function icsDate(date: string, minute: number) {
  // Academy time is IST (UTC+05:30, no DST) — convert to UTC for the calendar file.
  const d = new Date(new Date(`${date}T00:00:00+05:30`).getTime() + minute * 60_000);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]/ics">) {
  const { code } = await ctx.params;
  const { booking } = await findAccessibleBooking(code, req.nextUrl.searchParams.get("t"));
  if (!booking) return new Response("Not found", { status: 404 });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmashPoint//Court Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.code}@smashpoint.in`,
    `DTSTAMP:${icsDate(booking.date, 0)}`,
    `DTSTART:${icsDate(booking.date, booking.startMinute)}`,
    `DTEND:${icsDate(booking.date, booking.endMinute)}`,
    `SUMMARY:Badminton · ${booking.court.name} (${booking.code})`,
    `LOCATION:${site.name}\\, ${site.contact.addressLines.join("\\, ")}`,
    "DESCRIPTION:Please arrive 10 minutes early. Non-marking shoes only.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
