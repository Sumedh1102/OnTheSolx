import type { NextRequest } from "next/server";
import { getAvailability } from "@/server/services/bookings";
import { errorResponse, json } from "@/server/http";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") ?? "";
    const duration = Number(req.nextUrl.searchParams.get("duration") ?? 60);
    if (!isValidISODate(date)) return json({ error: "Invalid date" }, { status: 400 });
    return json(await getAvailability(date, Number.isFinite(duration) ? duration : 60));
  } catch (err) {
    return errorResponse(err);
  }
}
