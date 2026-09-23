import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sum, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts } from "@/server/db/schema";

export const BOOKING_PAGE_SIZE = 20;

export async function listBookings(p: { q?: string; from?: string; to?: string; court?: string; status?: string; source?: string; sort?: string; dir?: "asc" | "desc"; page?: number }) {
  const where: SQL[] = [];
  if (p.q?.trim()) {
    const term = `%${p.q.trim().replace(/[%_]/g, "\\$&")}%`;
    where.push(or(ilike(bookings.code, term), ilike(bookings.customerName, term), ilike(bookings.customerPhone, term), ilike(bookings.customerEmail, term))!);
  }
  if (p.from) where.push(gte(bookings.date, p.from));
  if (p.to) where.push(lte(bookings.date, p.to));
  if (p.court) where.push(eq(bookings.courtId, p.court));
  if (p.status) {
    const statuses = p.status === "ACTIVE" ? ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"] : [p.status];
    where.push(inArray(bookings.status, statuses as ("PENDING" | "CONFIRMED")[]));
  }
  if (p.source) where.push(eq(bookings.source, p.source as "ONLINE"));
  const whereSql = where.length ? and(...where) : undefined;
  const page = Math.max(1, p.page ?? 1);
  const dir = p.dir === "asc" ? asc : desc;
  const order = p.sort === "created" ? [dir(bookings.createdAt)] : p.sort === "amount" ? [dir(bookings.total)] : [dir(bookings.date), dir(bookings.startMinute)];

  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        date: bookings.date,
        startMinute: bookings.startMinute,
        endMinute: bookings.endMinute,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        total: bookings.total,
        status: bookings.status,
        source: bookings.source,
        courtName: courts.name,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(whereSql)
      .orderBy(...order)
      .limit(BOOKING_PAGE_SIZE)
      .offset((page - 1) * BOOKING_PAGE_SIZE),
    db.select({ total: count(), revenue: sum(bookings.total) }).from(bookings).where(whereSql),
  ]);
  const total = agg?.total ?? 0;
  return { rows, total, revenue: Number(agg?.revenue ?? 0), page, pageCount: Math.max(1, Math.ceil(total / BOOKING_PAGE_SIZE)) };
}

export async function getBookingDetail(id: string) {
  const [row] = await db.query.bookings.findMany({
    where: eq(bookings.id, id),
    with: {
      court: true,
      user: { columns: { id: true, name: true, email: true, phone: true } },
      coupon: { columns: { code: true } },
      events: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
      payments: { orderBy: (p, { desc }) => [desc(p.createdAt)] },
    },
    limit: 1,
  });
  return row ?? null;
}

export async function getCourtOptions() {
  return db.select({ id: courts.id, name: courts.name, status: courts.status }).from(courts).orderBy(asc(courts.sortOrder));
}
