import { getPaymentProvider } from "@/server/payments";
import { capturePayment, failPayment } from "@/server/payments/service";

/**
 * Server-to-server payment notifications. The provider adapter verifies the webhook
 * signature; unverifiable requests are rejected. Handlers are idempotent.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider: providerId } = await ctx.params;
  let provider;
  try {
    provider = getPaymentProvider(providerId);
  } catch {
    return new Response("Unknown provider", { status: 404 });
  }
  if (!provider.parseWebhook) return new Response("Webhooks not supported", { status: 404 });

  const raw = await req.text();
  const event = await provider.parseWebhook(raw, req.headers);
  if (!event) return new Response("Ignored", { status: 400 });

  try {
    if (event.type === "payment.captured") {
      await capturePayment({ providerId, orderId: event.orderId, providerPaymentId: event.providerPaymentId, preVerified: true });
    } else {
      await failPayment({ providerId, orderId: event.orderId, reason: event.reason });
    }
    return new Response("OK");
  } catch (err) {
    console.error("[webhook] processing failed", err);
    return new Response("Error", { status: 500 });
  }
}
