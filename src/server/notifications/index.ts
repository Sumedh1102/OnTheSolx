import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/server/db";
import { notificationDeliveries, notifications, users, type NotificationType, type UserPreferences } from "@/server/db/schema";
import { getSetting } from "@/server/settings";
import { adapters, type ExternalChannel } from "./channels";

type Recipient = { name: string; email?: string | null; phone?: string | null };

export type NotifyInput = {
  userId?: string | null;
  /** Used for guests (no account) or to override contact details. */
  recipient?: Recipient;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  channels?: ExternalChannel[];
};

const DEFAULT_CHANNELS: Record<NotificationType, ExternalChannel[]> = {
  BOOKING_CONFIRMED: ["EMAIL", "WHATSAPP"],
  BOOKING_REMINDER: ["WHATSAPP", "SMS"],
  BOOKING_CANCELLED: ["EMAIL", "WHATSAPP"],
  MEMBERSHIP_EXPIRY: ["EMAIL", "WHATSAPP"],
  PAYMENT_RECEIVED: ["EMAIL"],
  ANNOUNCEMENT: ["EMAIL"],
  CLASS_REMINDER: ["WHATSAPP"],
  EVENT: ["EMAIL"],
  GENERAL: [],
};

const PREF_FOR_CHANNEL: Record<ExternalChannel, keyof UserPreferences> = {
  EMAIL: "emailNotifications",
  SMS: "smsNotifications",
  WHATSAPP: "whatsappNotifications",
};

/** Runs work after the response is sent when inside a request; inline otherwise (scripts, tests). */
function defer(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task().catch((err) => console.error("[notify] deferred task failed", err));
  }
}

async function deliver(notificationId: string | null, userId: string | null, recipient: Recipient, channels: ExternalChannel[], subject: string, text: string) {
  const academy = await getSetting("notifications");
  for (const channel of channels) {
    if ((channel === "EMAIL" && !academy.email) || (channel === "SMS" && !academy.sms) || (channel === "WHATSAPP" && !academy.whatsapp)) continue;
    const to = channel === "EMAIL" ? recipient.email : recipient.phone;
    if (!to) continue;
    const adapter = adapters[channel];
    const base = { notificationId, userId, channel, recipient: to, provider: adapter.provider };
    if (!adapter.configured) {
      if (process.env.NODE_ENV !== "production") console.info(`[notify:${channel}] (not configured) → ${to}: ${subject}`);
      await db.insert(notificationDeliveries).values({ ...base, status: "SKIPPED", error: "Channel not configured" });
      continue;
    }
    try {
      const res = await adapter.send({ to, subject, text });
      await db.insert(notificationDeliveries).values({ ...base, status: "SENT", providerMessageId: res.providerMessageId, sentAt: new Date() });
    } catch (err) {
      await db.insert(notificationDeliveries).values({ ...base, status: "FAILED", error: String((err as Error).message).slice(0, 300) });
    }
  }
}

/** Creates an in-app notification (when a user is known) and fans out to email/SMS/WhatsApp. */
export async function notify(input: NotifyInput) {
  let notificationId: string | null = null;
  let recipient: Recipient | undefined = input.recipient;
  let prefs: UserPreferences | null = null;

  if (input.userId) {
    const [row] = await db
      .insert(notifications)
      .values({ userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null })
      .returning({ id: notifications.id });
    notificationId = row!.id;
    const [user] = await db
      .select({ name: users.name, email: users.email, phone: users.phone, preferences: users.preferences })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (user) {
      recipient = { name: user.name, email: input.recipient?.email ?? user.email, phone: input.recipient?.phone ?? user.phone };
      prefs = user.preferences ?? null;
    }
  }

  const channels = (input.channels ?? DEFAULT_CHANNELS[input.type]).filter((c) => !prefs || prefs[PREF_FOR_CHANNEL[c]] !== false);
  if (!recipient || channels.length === 0) return;
  const r = recipient;
  const text = `Hi ${r.name.split(" ")[0]},\n\n${input.body}\n\n— SmashPoint Badminton Academy`;
  defer(() => deliver(notificationId, input.userId ?? null, r, channels, input.title, text));
}

/** In-app broadcast (announcements). External channels are intentionally not used for bulk sends. */
export async function notifyUsers(userIds: string[], payload: { type: NotificationType; title: string; body: string; link?: string }) {
  if (!userIds.length) return 0;
  const chunk = 500;
  for (let i = 0; i < userIds.length; i += chunk) {
    await db.insert(notifications).values(userIds.slice(i, i + chunk).map((userId) => ({ userId, ...payload, link: payload.link ?? null })));
  }
  return userIds.length;
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids?.length ? inArray(notifications.id, ids) : undefined));
}
