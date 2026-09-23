import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { notificationDeliveries, passwordResetTokens, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { revokeOtherSessions } from "@/server/auth/session";
import { adapters } from "@/server/notifications/channels";
import { randomToken, sha256 } from "@/server/security";
import { audit } from "@/server/audit";
import { site } from "@/content/site";

export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Emails a single-use reset link if the address belongs to an active account. Callers must
 * respond identically either way so the form can't be used to discover accounts.
 */
export async function sendPasswordResetLink(email: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (!user || !user.isActive) return;

  const token = randomToken(32);
  await db.transaction(async (tx) => {
    // Only the newest link works.
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
    });
  });

  const link = `${site.url}/reset-password?token=${token}`;
  const subject = `Reset your ${site.shortName} password`;
  const text =
    `Hi ${user.name.split(" ")[0]},\n\n` +
    `We received a request to reset the password for your ${site.name} account. ` +
    `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to choose a new one:\n\n${link}\n\n` +
    `If you didn't ask for this, you can ignore this email; your password won't change.\n\n— ${site.name}`;

  const channel = adapters.EMAIL;
  const base = { notificationId: null, userId: user.id, channel: "EMAIL" as const, recipient: user.email, provider: channel.provider };
  if (!channel.configured) {
    if (process.env.NODE_ENV !== "production") console.info(`[password-reset] email not configured; reset link for ${user.email}: ${link}`);
    await db.insert(notificationDeliveries).values({ ...base, status: "SKIPPED", error: "Channel not configured" });
    return;
  }
  try {
    const res = await channel.send({ to: user.email, subject, text });
    await db.insert(notificationDeliveries).values({ ...base, status: "SENT", providerMessageId: res.providerMessageId, sentAt: new Date() });
  } catch (err) {
    console.error("[password-reset] email failed", err);
    await db.insert(notificationDeliveries).values({ ...base, status: "FAILED", error: String((err as Error).message).slice(0, 300) });
  }
}

/** True when the token exists, is unused and hasn't expired (used to render the reset form). */
export async function isResetTokenUsable(token: string) {
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);
  return !!row;
}

/**
 * Atomically consumes the token and sets the new password. Every existing session of the
 * user is signed out. Returns false if the link is invalid, used or expired.
 */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  const userId = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.tokenHash, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed) return null;
    await tx.update(users).set({ passwordHash }).where(and(eq(users.id, consumed.userId), eq(users.isActive, true)));
    return consumed.userId;
  });
  if (!userId) return false;
  await revokeOtherSessions(userId);
  await audit(userId, "password.reset", "user", userId);
  return true;
}
