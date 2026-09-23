"use server";

import { and, desc, eq, gte, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { membershipPlans, memberships, students } from "@/server/db/schema";
import { assertPermission, assertUser } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { invalidate, TAGS } from "@/server/cache";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { recordOfflinePayment, startPayment } from "@/server/payments/service";
import type { CheckoutInstruction } from "@/server/payments/types";
import { canViewStudent } from "@/server/queries/viewer";
import { resolveCoupon } from "@/server/services/coupons";
import { applyDiscount } from "@/lib/booking/engine";
import { addDays, addMonths, todayInTz } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { isoDate } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  durationMonths: z.coerce.number().int().min(1).max(24),
  price: z.coerce.number().min(0).max(1000000).transform((v) => Math.round(v * 100)),
  trainingAccess: z.string().trim().min(3).max(160),
  benefits: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10)),
  courtDiscountPercent: z.coerce.number().int().min(0).max(50),
  isFeatured: z.string().optional().transform((v) => v === "on"),
  isActive: z.string().optional().transform((v) => v === "on"),
  sortOrder: z.coerce.number().int().min(0).max(99),
});

function refreshPlans() {
  revalidatePath("/dashboard/memberships");
  invalidate(TAGS.plans);
}

export async function createPlan(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("memberships:manage");
    const input = planSchema.parse(formObject(formData));
    await db.insert(membershipPlans).values({ ...input, slug: slugify(input.name) });
    await audit(actor.id, "plan.create", "membership_plan", null, { name: input.name });
    refreshPlans();
    return { ok: true, message: `${input.name} plan created` };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A plan with this name already exists." };
    return toActionError(err);
  }
}

export async function updatePlan(planId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("memberships:manage");
    const input = planSchema.parse(formObject(formData));
    await db.update(membershipPlans).set(input).where(eq(membershipPlans.id, planId));
    await audit(actor.id, "plan.update", "membership_plan", planId, input);
    refreshPlans();
    return { ok: true, message: "Plan saved" };
  } catch (err) {
    return toActionError(err);
  }
}

/** A new term starts the day after the current active term ends (renewals never lose days). */
async function nextStartDate(studentId: string, requested?: string | null) {
  const today = todayInTz();
  const [current] = await db
    .select({ endDate: memberships.endDate })
    .from(memberships)
    .where(and(eq(memberships.studentId, studentId), eq(memberships.status, "ACTIVE"), gte(memberships.endDate, today)))
    .orderBy(desc(memberships.endDate))
    .limit(1);
  const earliest = current ? addDays(current.endDate, 1) : today;
  return { start: requested && requested > earliest ? requested : earliest, renewing: !!current };
}

const assignSchema = z.object({
  studentId: z.uuid(),
  planId: z.uuid(),
  startDate: z.union([z.literal(""), isoDate]).optional(),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "UNPAID"]),
  notes: z.string().trim().max(300).optional(),
});

export async function assignMembership(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("memberships:manage");
    const input = assignSchema.parse(formObject(formData));
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, input.planId)).limit(1);
    const [student] = await db.select().from(students).where(eq(students.id, input.studentId)).limit(1);
    if (!plan || !student) throw new DomainError("Choose a valid student and plan.");
    const { start, renewing } = await nextStartDate(student.id, input.startDate || null);
    const end = addDays(addMonths(start, plan.durationMonths), -1);
    const [prev] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.studentId, student.id), ne(memberships.status, "CANCELLED"))).orderBy(desc(memberships.endDate)).limit(1);
    const [m] = await db
      .insert(memberships)
      .values({
        studentId: student.id,
        planId: plan.id,
        startDate: start,
        endDate: end,
        status: input.method === "UNPAID" ? "PENDING" : "ACTIVE",
        paymentStatus: "CREATED",
        price: plan.price,
        renewedFromId: prev?.id ?? null,
        notes: input.notes || null,
      })
      .returning();
    if (input.method !== "UNPAID") {
      await recordOfflinePayment({
        purpose: "MEMBERSHIP",
        membershipId: m!.id,
        studentId: student.id,
        userId: student.userId,
        amount: plan.price,
        method: input.method,
        payer: { name: student.name, email: student.email, phone: student.phone ?? student.emergencyContactPhone },
        actorId: actor.id,
      });
    }
    await audit(actor.id, renewing ? "membership.renew" : "membership.assign", "membership", m!.id, { plan: plan.name });
    revalidatePath("/dashboard/memberships");
    revalidatePath(`/dashboard/students/${student.id}`);
    return { ok: true, message: `${plan.name} ${renewing ? "renewal" : "membership"} for ${student.name}: ${start} → ${end}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelMembership(membershipId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("memberships:manage");
    await db.update(memberships).set({ status: "CANCELLED" }).where(eq(memberships.id, membershipId));
    await audit(actor.id, "membership.cancel", "membership", membershipId);
    revalidatePath("/dashboard/memberships");
    return { ok: true, message: "Membership cancelled" };
  } catch (err) {
    return toActionError(err);
  }
}

/** Student/parent self-service purchase or renewal → online checkout. */
export async function purchaseMembership(
  _prev: ActionResult<{ checkout: CheckoutInstruction }> | null,
  formData: FormData,
): Promise<ActionResult<{ checkout: CheckoutInstruction }>> {
  try {
    const user = await assertUser();
    const input = z.object({ studentId: z.uuid(), planId: z.uuid(), coupon: z.string().trim().max(30).optional() }).parse(formObject(formData));
    if (!(await canViewStudent(user, input.studentId))) throw new DomainError("You can only buy memberships for your own profile or children.");
    const [plan] = await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, input.planId), eq(membershipPlans.isActive, true))).limit(1);
    const [student] = await db.select().from(students).where(eq(students.id, input.studentId)).limit(1);
    if (!plan || !student) throw new DomainError("That plan isn't available.");

    let price = plan.price;
    if (input.coupon) {
      const res = await resolveCoupon(db, input.coupon, "MEMBERSHIP", price, todayInTz());
      if (!res.ok) throw new DomainError(res.message);
      price = applyDiscount(price, res.coupon).total;
    }
    const { start } = await nextStartDate(student.id);
    const end = addDays(addMonths(start, plan.durationMonths), -1);
    const [m] = await db
      .insert(memberships)
      .values({ studentId: student.id, planId: plan.id, startDate: start, endDate: end, status: "PENDING", paymentStatus: "INITIATED", price })
      .returning();
    const { checkout } = await startPayment({
      purpose: "MEMBERSHIP",
      amount: price,
      description: `${plan.name} membership · ${student.name}`,
      payer: { name: user.name, email: user.email, phone: user.phone },
      userId: user.id,
      studentId: student.id,
      membershipId: m!.id,
    });
    return { ok: true, message: "Redirecting to payment…", data: { checkout } };
  } catch (err) {
    return toActionError(err);
  }
}
