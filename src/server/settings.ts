import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type AttendanceSettings,
  type BookingSettings,
  type NotificationSettings,
} from "@/lib/settings-types";

type SettingsMap = {
  booking: BookingSettings;
  notifications: NotificationSettings;
  attendance: AttendanceSettings;
};

const DEFAULTS: SettingsMap = {
  booking: DEFAULT_BOOKING_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  attendance: DEFAULT_ATTENDANCE_SETTINGS,
};

/** Reads a settings document merged over its defaults (memoised per request). */
export const getSetting = cache(async <K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> => {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return { ...DEFAULTS[key], ...((row?.value as Partial<SettingsMap[K]>) ?? {}) };
});

export async function saveSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K], userId?: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedById: userId ?? null })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: userId ?? null, updatedAt: new Date() } });
}

export const getBookingSettings = () => getSetting("booking");
