import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings } from "@/server/db/schema";
import { can } from "@/lib/rbac";
import { getCurrentUser } from "@/server/auth/guards";
import { verifyBookingAccess } from "@/server/security";

/**
 * A booking is visible to: its signed-in owner, staff with bookings permission, or anyone
 * holding the signed capability link sent at checkout (for guest bookings). Booking codes
 * alone are never enough, so receipts can't be enumerated.
 */
export async function findAccessibleBooking(code: string, token: string | null | undefined) {
  const normalized = code.toUpperCase();
  const [booking] = await db.query.bookings.findMany({
    where: eq(bookings.code, normalized),
    with: { court: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] }, payments: { orderBy: (p, { desc }) => [desc(p.createdAt)] } },
    limit: 1,
  });
  if (!booking) return { booking: null, access: false as const, viaToken: false };
  if (verifyBookingAccess(normalized, token)) return { booking, access: true as const, viaToken: true };
  const user = await getCurrentUser();
  if (user && (booking.userId === user.id || can(user.role, "bookings:manage"))) return { booking, access: true as const, viaToken: false };
  return { booking: null, access: false as const, viaToken: false };
}
