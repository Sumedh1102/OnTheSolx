"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { refundPayment } from "@/server/payments/service";
import { toActionError, type ActionResult } from "./result";

export async function refundPaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("payments:refund");
    await refundPayment(paymentId, { reason: "Refunded by academy", actorId: actor.id });
    await audit(actor.id, "payment.refund", "payment", paymentId);
    revalidatePath("/dashboard/payments");
    return { ok: true, message: "Refund issued" };
  } catch (err) {
    return toActionError(err);
  }
}
