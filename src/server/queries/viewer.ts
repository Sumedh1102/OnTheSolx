import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { announcements, coaches, notifications, parents, students } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/session";

/** Students the signed-in user may see as a student/parent: themselves and/or their children. */
export const getViewerStudents = cache(async (user: Pick<SessionUser, "id">) => {
  const own = await db
    .select({ id: students.id, name: students.name, studentCode: students.studentCode, photoUrl: students.photoUrl })
    .from(students)
    .where(eq(students.userId, user.id));
  const children = await db
    .select({ id: students.id, name: students.name, studentCode: students.studentCode, photoUrl: students.photoUrl })
    .from(students)
    .innerJoin(parents, eq(parents.id, students.parentId))
    .where(eq(parents.userId, user.id))
    .orderBy(asc(students.name));
  return [...own.map((s) => ({ ...s, relation: "self" as const })), ...children.map((s) => ({ ...s, relation: "child" as const }))];
});

export async function canViewStudent(user: Pick<SessionUser, "id">, studentId: string) {
  return (await getViewerStudents(user)).some((s) => s.id === studentId);
}

export const getCoachForUser = cache(async (userId: string) => {
  const [coach] = await db.select().from(coaches).where(eq(coaches.userId, userId)).limit(1);
  return coach ?? null;
});

export async function getNotifications(userId: string, limit = 20) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadCount(userId: string) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .limit(50);
  return rows.length;
}

export async function getAnnouncementsFor(audience: "STUDENTS" | "STAFF", limit = 5) {
  const now = new Date();
  return db
    .select()
    .from(announcements)
    .where(
      and(
        inArray(announcements.audience, ["EVERYONE", audience]),
        lte(announcements.publishedAt, now),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
      ),
    )
    .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt))
    .limit(limit);
}
