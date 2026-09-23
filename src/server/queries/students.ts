import "server-only";
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { batchStudents, batches, coaches, memberships, membershipPlans, parents, students, users } from "@/server/db/schema";

export const STUDENT_PAGE_SIZE = 15;

export type StudentListParams = {
  q?: string;
  status?: string;
  level?: string;
  batch?: string;
  coach?: string;
  membership?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  /** Restrict to these ids (coach scope). */
  scopeIds?: string[] | null;
  today: string;
};

const currentMembership = (today: string) => sql`(
  select json_build_object('status', m.status, 'endDate', m.end_date, 'paymentStatus', m.payment_status, 'plan', p.name)
  from ${memberships} m join ${membershipPlans} p on p.id = m.plan_id
  where m.student_id = ${students.id} and m.status <> 'CANCELLED'
  order by (m.start_date <= ${today}::date and m.end_date >= ${today}::date) desc, m.end_date desc
  limit 1
)`;

export async function listStudents(p: StudentListParams) {
  const where: SQL[] = [];
  if (p.scopeIds) where.push(p.scopeIds.length ? inArray(students.id, p.scopeIds) : sql`false`);
  if (p.q?.trim()) {
    const term = `%${p.q.trim().replace(/[%_]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(students.name, term),
        ilike(students.studentCode, term),
        ilike(students.phone, term),
        ilike(students.email, term),
        exists(db.select({ x: sql`1` }).from(parents).where(and(eq(parents.id, students.parentId), or(ilike(parents.name, term), ilike(parents.phone, term))))),
      )!,
    );
  }
  if (p.status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(p.status)) where.push(eq(students.status, p.status as "ACTIVE"));
  if (p.level && ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(p.level)) where.push(eq(students.level, p.level as "BEGINNER"));
  if (p.coach) where.push(eq(students.coachId, p.coach));
  if (p.batch) where.push(exists(db.select({ x: sql`1` }).from(batchStudents).where(and(eq(batchStudents.studentId, students.id), eq(batchStudents.batchId, p.batch), eq(batchStudents.isActive, true)))));
  if (p.membership === "active") {
    where.push(sql`exists (select 1 from ${memberships} m where m.student_id = ${students.id} and m.status = 'ACTIVE' and m.end_date >= ${p.today}::date)`);
  } else if (p.membership === "expiring") {
    where.push(sql`exists (select 1 from ${memberships} m where m.student_id = ${students.id} and m.status = 'ACTIVE' and m.end_date between ${p.today}::date and (${p.today}::date + 7))`);
  } else if (p.membership === "expired") {
    where.push(sql`not exists (select 1 from ${memberships} m where m.student_id = ${students.id} and m.status = 'ACTIVE' and m.end_date >= ${p.today}::date)`);
  }

  const whereSql = where.length ? and(...where) : undefined;
  const dir = p.dir === "desc" ? desc : asc;
  const order =
    p.sort === "joined" ? [dir(students.joiningDate), asc(students.name)] : p.sort === "code" ? [dir(students.studentCode)] : p.sort === "level" ? [dir(students.level), asc(students.name)] : [dir(students.name)];
  const page = Math.max(1, p.page ?? 1);

  const [rows, [{ total }]] = (await Promise.all([
    db
      .select({
        id: students.id,
        name: students.name,
        studentCode: students.studentCode,
        photoUrl: students.photoUrl,
        dateOfBirth: students.dateOfBirth,
        level: students.level,
        status: students.status,
        phone: students.phone,
        joiningDate: students.joiningDate,
        coachName: users.name,
        parentName: parents.name,
        parentPhone: parents.phone,
        batchNames: sql<string[]>`coalesce((select array_agg(b.name order by b.start_minute) from ${batchStudents} bs join ${batches} b on b.id = bs.batch_id where bs.student_id = ${students.id} and bs.is_active), '{}')`,
        membership: currentMembership(p.today).mapWith((v) => v as { status: string; endDate: string; paymentStatus: string; plan: string } | null),
      })
      .from(students)
      .leftJoin(coaches, eq(coaches.id, students.coachId))
      .leftJoin(users, eq(users.id, coaches.userId))
      .leftJoin(parents, eq(parents.id, students.parentId))
      .where(whereSql)
      .orderBy(...order)
      .limit(STUDENT_PAGE_SIZE)
      .offset((page - 1) * STUDENT_PAGE_SIZE),
    db.select({ total: count() }).from(students).where(whereSql),
  ])) as [unknown[], [{ total: number }]];

  return {
    rows: rows as {
      id: string;
      name: string;
      studentCode: string;
      photoUrl: string | null;
      dateOfBirth: string | null;
      level: string;
      status: string;
      phone: string | null;
      joiningDate: string;
      coachName: string | null;
      parentName: string | null;
      parentPhone: string | null;
      batchNames: string[];
      membership: { status: string; endDate: string; paymentStatus: string; plan: string } | null;
    }[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE)),
  };
}

export async function getStudentOptions() {
  return db.select({ id: students.id, name: students.name, studentCode: students.studentCode }).from(students).where(eq(students.status, "ACTIVE")).orderBy(asc(students.name));
}

export async function getCoachOptions() {
  return db.select({ id: coaches.id, name: users.name }).from(coaches).innerJoin(users, eq(users.id, coaches.userId)).where(eq(users.isActive, true)).orderBy(asc(users.name));
}

export async function getBatchOptions() {
  return db.select({ id: batches.id, name: batches.name, capacity: batches.capacity, coachId: batches.coachId }).from(batches).where(eq(batches.isActive, true)).orderBy(asc(batches.startMinute));
}
