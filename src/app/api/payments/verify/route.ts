import { z } from "zod";
import { errorResponse, json, readJson } from "@/server/http";
import { capturePayment, paymentReturnUrl } from "@/server/payments/service";

const schema = z.object({
  provider: z.string().min(1).max(30),
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(300),
});

/** Client-side success callback from an SDK checkout (e.g. Razorpay). The signature is verified server-side. */
export async function POST(req: Request) {
  try {
    const input = schema.parse(await readJson(req));
    const payment = await capturePayment({ providerId: input.provider, orderId: input.orderId, providerPaymentId: input.paymentId, signature: input.signature });
    return json({ ok: true, redirect: await paymentReturnUrl(payment) });
  } catch (err) {
    return errorResponse(err);
  }
}
