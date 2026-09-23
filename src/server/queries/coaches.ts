import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { attendanceSessions, batchStudents, batches, coaches, students, users } from "@/server/db/schema";

export async function listCoachesWithStats(monthStart: string) {
  return db
    .select({
      id: coaches.id,
      slug: coaches.slug,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      title: coaches.title,
      experienceYears: coaches.experienceYears,
      specialization: coaches.specialization,
      photoUrl: coaches.photoUrl,
      isPublic: coaches.isPublic,
      batchCount: sql<number>`(select count(*)::int from ${batches} b where b.coach_id = ${coaches.id} and b.is_active)`,
      studentCount: sql<number>`(select count(distinct bs.student_id)::int from ${batchStudents} bs join ${batches} b on b.id = bs.batch_id where b.coach_id = ${coaches.id} and bs.is_active)`,
      primaryStudents: sql<number>`(select count(*)::int from ${students} s where s.coach_id = ${coaches.id} and s.status = 'ACTIVE')`,
      sessionsThisMonth: sql<number>`(select count(*)::int from ${attendanceSessions} a join ${batches} b on b.id = a.batch_id where b.coach_id = ${coaches.id} and a.date >= ${monthStart}::date)`,
    })
    .from(coaches)
    .innerJoin(users, eq(users.id, coaches.userId))
    .orderBy(asc(coaches.sortOrder), asc(users.name));
}

export async function getCoachDetail(id: string) {
  const [row] = await db
    .select({ coach: coaches, name: users.name, email: users.email, phone: users.phone, isActive: users.isActive })
    .from(coaches)
    .innerJoin(users, eq(users.id, coaches.userId))
    .where(eq(coaches.id, id))
    .limit(1);
  return row ?? null;
}
