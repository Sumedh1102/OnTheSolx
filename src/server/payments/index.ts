import "server-only";
import { mockProvider } from "./providers/mock";
import { razorpayProvider } from "./providers/razorpay";
import type { PaymentProvider } from "./types";

/**
 * Provider registry. To add a gateway (Cashfree, PhonePe, …) implement PaymentProvider
 * in ./providers/<name>.ts and add it here.
 */
const providers: Record<string, PaymentProvider> = {
  [mockProvider.id]: mockProvider,
  [razorpayProvider.id]: razorpayProvider,
};

export function getPaymentProvider(id?: string | null): PaymentProvider {
  const key = id ?? process.env.PAYMENT_PROVIDER ?? "mock";
  const provider = providers[key];
  if (!provider) throw new Error(`Unknown payment provider "${key}"`);
  // The sandbox lets anyone mark a payment as paid, so production only allows it for demos.
  if (provider.id === "mock" && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("The sandbox payment gateway is disabled in production. Set PAYMENT_PROVIDER=razorpay (or DEMO_MODE=true for a demo).");
  }
  return provider;
}

export function activePaymentProviderId() {
  return getPaymentProvider().id;
}

export type { PaymentProvider } from "./types";
