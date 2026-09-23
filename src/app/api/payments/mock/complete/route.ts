import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { activePaymentProviderId } from "@/server/payments";
import { mockSignature } from "@/server/payments/providers/mock";
import { capturePayment, failPayment, paymentReturnUrl } from "@/server/payments/service";

const schema = z.object({ paymentId: z.uuid(), outcome: z.enum(["success", "failure"]) });

/**
 * Sandbox gateway callback. Simulates the provider signing the result, then runs the exact
 * same verification + capture path as a real gateway. Disabled unless PAYMENT_PROVIDER=mock.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (activePaymentProviderId() !== "mock") throw new DomainError("Sandbox payments are disabled.", "FORBIDDEN", 403);
    const input = schema.parse(await readJson(req));
    const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
    if (!payment || payment.provider !== "mock" || !payment.providerOrderId) throw new DomainError("Payment not found.", "NOT_FOUND", 404);
    if (payment.status === "PAID") return json({ redirect: await paymentReturnUrl(payment) });
    if (payment.status !== "INITIATED") throw new DomainError("This payment session has ended. Please start again.", "EXPIRED", 410);

    if (input.outcome === "failure") {
      await failPayment({ providerId: "mock", orderId: payment.providerOrderId, reason: "Payment declined by bank (simulated)" });
      return json({ redirect: await paymentReturnUrl(payment, "failed") });
    }
    const providerPaymentId = `mock_pay_${randomBytes(9).toString("hex")}`;
    const captured = await capturePayment({
      providerId: "mock",
      orderId: payment.providerOrderId,
      providerPaymentId,
      signature: mockSignature(payment.providerOrderId, providerPaymentId),
    });
    return json({ redirect: await paymentReturnUrl(captured) });
  } catch (err) {
    return errorResponse(err);
  }
}
