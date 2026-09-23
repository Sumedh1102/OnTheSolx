import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { membershipPlans, memberships, students } from "@/server/db/schema";
import { addDays } from "@/lib/time";

export const MEMBERSHIP_PAGE_SIZE = 20;

export async function listMemberships(p: { filter?: string; q?: string; page?: number; today: string }) {
  const where: SQL[] = [];
  if (p.filter === "active") where.push(eq(memberships.status, "ACTIVE"), gte(memberships.endDate, p.today));
  else if (p.filter === "expiring") where.push(eq(memberships.status, "ACTIVE"), gte(memberships.endDate, p.today), lte(memberships.endDate, addDays(p.today, 7)));
  else if (p.filter === "expired") where.push(or(eq(memberships.status, "EXPIRED"), and(eq(memberships.status, "ACTIVE"), lt(memberships.endDate, p.today)))!);
  else if (p.filter === "pending") where.push(eq(memberships.status, "PENDING"));
  if (p.q?.trim()) where.push(or(ilike(students.name, `%${p.q.trim()}%`), ilike(students.studentCode, `%${p.q.trim()}%`))!);
  const whereSql = where.length ? and(...where) : undefined;
  const page = Math.max(1, p.page ?? 1);
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: memberships.id,
        startDate: memberships.startDate,
        endDate: memberships.endDate,
        status: memberships.status,
        paymentStatus: memberships.paymentStatus,
        price: memberships.price,
        planName: membershipPlans.name,
        studentId: students.id,
        studentName: students.name,
        studentCode: students.studentCode,
      })
      .from(memberships)
      .innerJoin(students, eq(students.id, memberships.studentId))
      .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
      .where(whereSql)
      .orderBy(p.filter === "expiring" ? asc(memberships.endDate) : desc(memberships.endDate))
      .limit(MEMBERSHIP_PAGE_SIZE)
      .offset((page - 1) * MEMBERSHIP_PAGE_SIZE),
    db.select({ total: count() }).from(memberships).innerJoin(students, eq(students.id, memberships.studentId)).where(whereSql),
  ]);
  const total = agg?.total ?? 0;
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / MEMBERSHIP_PAGE_SIZE)) };
}

export async function getAllPlans() {
  return db.select().from(membershipPlans).orderBy(asc(membershipPlans.sortOrder));
}
