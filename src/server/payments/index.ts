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
  return provider;
}

export function activePaymentProviderId() {
  return getPaymentProvider().id;
}

export type { PaymentProvider } from "./types";
