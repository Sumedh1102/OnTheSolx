import "server-only";
import { and, eq, gt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";
import { sessions, users, type User } from "@/server/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SIGNED_IN_HINT_COOKIE,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "phone" | "role" | "avatarUrl" | "emergencyContactName" | "emergencyContactPhone" | "preferences"
>;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function createSession(user: Pick<User, "id" | "role">) {
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const [row] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null)?.slice(0, 64) ?? null,
    })
    .returning({ id: sessions.id });

  const token = await signSessionToken({ sid: row!.id, sub: user.id, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
  jar.set(SIGNED_IN_HINT_COOKIE, "1", { ...cookieBase, httpOnly: false, expires: expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
}

export async function destroySession() {
  const jar = await cookies();
  const claims = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (claims) await db.delete(sessions).where(eq(sessions.id, claims.sid));
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT_COOKIE);
}

/** Revokes every session of a user except (optionally) the current one — e.g. after a password change. */
export async function revokeOtherSessions(userId: string, keepSessionId?: string) {
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}

/**
 * Authoritative session lookup: verifies the signed token AND that the session row still
 * exists, hasn't expired and belongs to an active user. Memoised per request.
 */
export const getSession = cache(async (): Promise<{ sessionId: string; user: SessionUser } | null> => {
  const jar = await cookies();
  const claims = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      avatarUrl: users.avatarUrl,
      emergencyContactName: users.emergencyContactName,
      emergencyContactPhone: users.emergencyContactPhone,
      preferences: users.preferences,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, claims.sid), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !row.isActive) return null;
  const { sessionId, isActive: _active, ...user } = row;
  return { sessionId, user };
});
