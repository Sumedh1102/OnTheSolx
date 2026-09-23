import { z } from "zod";
import { errorResponse, json, readJson } from "@/server/http";
import { failPayment } from "@/server/payments/service";

const schema = z.object({ provider: z.string().min(1).max(30), orderId: z.string().min(1).max(100), reason: z.string().max(300).optional() });

export async function POST(req: Request) {
  try {
    const input = schema.parse(await readJson(req));
    await failPayment({ providerId: input.provider, orderId: input.orderId, reason: input.reason ?? "Payment failed at gateway" });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
