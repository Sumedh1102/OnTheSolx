import "server-only";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";

export const PAYMENT_PAGE_SIZE = 25;
const localDate = sql`(${payments.paidAt} AT TIME ZONE 'Asia/Kolkata')::date`;

export async function listPayments(p: { q?: string; status?: string; purpose?: string; method?: string; from?: string; to?: string; page?: number }) {
  const where: SQL[] = [];
  if (p.q?.trim()) {
    const t = `%${p.q.trim()}%`;
    where.push(or(ilike(payments.receiptNumber, t), ilike(payments.payerName, t), ilike(payments.payerPhone, t), ilike(payments.payerEmail, t), ilike(payments.providerPaymentId, t))!);
  }
  if (p.status) where.push(eq(payments.status, p.status as "PAID"));
  if (p.purpose) where.push(eq(payments.purpose, p.purpose as "BOOKING"));
  if (p.method) where.push(eq(payments.method, p.method as "CASH"));
  if (p.from) where.push(sql`${localDate} >= ${p.from}::date`);
  if (p.to) where.push(sql`${localDate} <= ${p.to}::date`);
  const whereSql = where.length ? and(...where) : undefined;
  const page = Math.max(1, p.page ?? 1);
  const [rows, [agg]] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(whereSql)
      .orderBy(desc(sql`coalesce(${payments.paidAt}, ${payments.createdAt})`))
      .limit(PAYMENT_PAGE_SIZE)
      .offset((page - 1) * PAYMENT_PAGE_SIZE),
    db
      .select({
        total: count(),
        collected: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'PAID'), 0)::bigint`,
        refunded: sql<number>`coalesce(sum(${payments.refundedAmount}) filter (where ${payments.status} = 'REFUNDED'), 0)::bigint`,
        failed: sql<number>`count(*) filter (where ${payments.status} = 'FAILED')::int`,
      })
      .from(payments)
      .where(whereSql),
  ]);
  const total = agg?.total ?? 0;
  return {
    rows,
    total,
    collected: Number(agg?.collected ?? 0),
    refunded: Number(agg?.refunded ?? 0),
    failed: agg?.failed ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAYMENT_PAGE_SIZE)),
  };
}
