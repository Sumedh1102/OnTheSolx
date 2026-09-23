"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { students, users } from "@/server/db/schema";
import { assertUser } from "@/server/auth/guards";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getSession, revokeOtherSessions } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { storeImage } from "@/server/media";
import { emailSchema, nameSchema, passwordSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalPhone = z.union([z.literal(""), phoneSchema]).optional().transform((v) => v || null);

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const input = z
      .object({
        name: nameSchema,
        email: emailSchema,
        phone: optionalPhone,
        emergencyContactName: z.string().trim().max(120).optional().transform((v) => v || null),
        emergencyContactPhone: optionalPhone,
      })
      .parse(formObject(formData));
    const [clash] = await db.select({ id: users.id }).from(users).where(and(eq(sql`lower(${users.email})`, input.email), ne(users.id, user.id))).limit(1);
    if (clash) return { ok: false, error: "That email is used by another account.", fieldErrors: { email: ["Already in use"] } };
    await db.update(users).set(input).where(eq(users.id, user.id));
    // Keep the linked student record's emergency contact in sync.
    if (input.emergencyContactName || input.emergencyContactPhone) {
      await db
        .update(students)
        .set({ emergencyContactName: input.emergencyContactName, emergencyContactPhone: input.emergencyContactPhone })
        .where(eq(students.userId, user.id));
    }
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const url = await storeImage(formData.get("avatar") as File | null, user.id);
    await db.update(users).set({ avatarUrl: url }).where(eq(users.id, user.id));
    await db.update(students).set({ photoUrl: url }).where(eq(students.userId, user.id));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile photo updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const input = z
      .object({ current: z.string().min(1, "Enter your current password"), next: passwordSchema, confirm: z.string() })
      .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
      .parse(formObject(formData));
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
    if (!row || !(await verifyPassword(input.current, row.passwordHash))) return { ok: false, error: "Current password is incorrect.", fieldErrors: { current: ["Incorrect password"] } };
    await db.update(users).set({ passwordHash: await hashPassword(input.next) }).where(eq(users.id, user.id));
    const session = await getSession();
    await revokeOtherSessions(user.id, session?.sessionId);
    await audit(user.id, "user.password_change", "user", user.id);
    return { ok: true, message: "Password changed — other devices were signed out" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updatePreferences(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const on = (k: string) => formData.get(k) === "on";
    await db
      .update(users)
      .set({
        preferences: {
          emailNotifications: on("emailNotifications"),
          smsNotifications: on("smsNotifications"),
          whatsappNotifications: on("whatsappNotifications"),
          bookingReminders: on("bookingReminders"),
          classReminders: on("classReminders"),
          marketing: on("marketing"),
        },
      })
      .where(eq(users.id, user.id));
    return { ok: true, message: "Preferences saved" };
  } catch (err) {
    return toActionError(err);
  }
}
