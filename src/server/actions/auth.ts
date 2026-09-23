"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { parents, students, users } from "@/server/db/schema";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { randomToken, rateLimit } from "@/server/security";
import { nextStudentCode } from "@/server/services/students";
import { emailSchema, isoDate, loginSchema, nameSchema, passwordSchema, phoneSchema } from "@/lib/validation";
import { todayInTz } from "@/lib/time";
import { formObject, toActionError, type ActionResult } from "./result";

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | undefined | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

const DEFAULT_PREFS = { emailNotifications: true, smsNotifications: false, whatsappNotifications: true, bookingReminders: true, classReminders: true, marketing: false };

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let next = "/dashboard";
  try {
    const input = loginSchema.parse(formObject(formData));
    next = safeNext(input.next);
    const limiter = rateLimit(`login:${await ip()}:${input.email}`, 8, 15 * 60_000);
    if (!limiter.ok) throw new DomainError("Too many attempts. Please wait a few minutes and try again.");

    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new DomainError("That email and password don't match.");
    if (!user.isActive) throw new DomainError("This account has been deactivated. Please contact the academy.");
    await createSession(user);
  } catch (err) {
    return toActionError(err);
  }
  redirect(next);
}

const registerFormSchema = z
  .object({
    accountType: z.enum(["player", "parent"]),
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    childName: z.string().trim().optional(),
    childDob: z.string().optional(),
    next: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.accountType === "parent") {
      if (!nameSchema.safeParse(v.childName).success) ctx.addIssue({ code: "custom", path: ["childName"], message: "Enter your child's name" });
      if (!isoDate.safeParse(v.childDob).success) ctx.addIssue({ code: "custom", path: ["childDob"], message: "Enter your child's date of birth" });
    }
  });

export async function register(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let next = "/dashboard";
  try {
    const input = registerFormSchema.parse(formObject(formData));
    next = safeNext(input.next);
    if (!rateLimit(`register:${await ip()}`, 5, 60 * 60_000).ok) throw new DomainError("Too many sign-ups from this network. Try again later.");

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
    if (existing) return { ok: false, error: "An account with this email already exists. Try signing in.", fieldErrors: { email: ["Already registered"] } };
    const passwordHash = await hashPassword(input.password);
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, phone: input.phone, passwordHash, role: "STUDENT", preferences: DEFAULT_PREFS })
        .returning();
      const studentCode = await nextStudentCode(tx);
      if (input.accountType === "parent") {
        const [parent] = await tx.insert(parents).values({ userId: created!.id, name: input.name, phone: input.phone, email: input.email }).returning();
        await tx.insert(students).values({
          parentId: parent!.id,
          studentCode,
          name: input.childName!,
          dateOfBirth: input.childDob!,
          joiningDate: todayInTz(),
          emergencyContactName: input.name,
          emergencyContactPhone: input.phone,
          qrToken: randomToken(18),
        });
      } else {
        await tx.insert(students).values({
          userId: created!.id,
          studentCode,
          name: input.name,
          phone: input.phone,
          email: input.email,
          joiningDate: todayInTz(),
          qrToken: randomToken(18),
        });
      }
      return created!;
    });
    await createSession(user);
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "An account with this email already exists. Try signing in.", fieldErrors: { email: ["Already registered"] } };
    return toActionError(err);
  }
  redirect(next);
}

export async function logout() {
  await destroySession();
  redirect("/");
}
