/**
 * Payment gateway abstraction. The rest of the app only talks to `PaymentProvider`;
 * adding Cashfree, PhonePe, Stripe, … means implementing this interface in
 * ./providers and registering it in ./index.ts — no changes to booking logic.
 */

export type CheckoutCustomer = { name: string; email?: string | null; phone?: string | null };

export type CreateOrderInput = {
  /** Our payment row id — providers may embed it in callbacks. */
  paymentId: string;
  amount: number; // minor units
  currency: string;
  receipt: string;
  description: string;
  customer: CheckoutCustomer;
  notes?: Record<string, string>;
};

/** What the browser should do next to collect the money. */
export type CheckoutInstruction =
  | { kind: "redirect"; url: string }
  | {
      kind: "razorpay";
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      prefill: { name?: string; email?: string; contact?: string };
    };

export type VerifyInput = { orderId: string; providerPaymentId: string; signature: string };

export type WebhookEvent =
  | { type: "payment.captured"; orderId: string; providerPaymentId: string }
  | { type: "payment.failed"; orderId: string; providerPaymentId?: string; reason?: string }
  /** Authentic, but nothing for us to do (other event types). */
  | { type: "ignored" };

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  createOrder(input: CreateOrderInput): Promise<{ orderId: string; checkout: CheckoutInstruction }>;
  /** Verifies the client-side success callback (signature check — never trust the browser alone). */
  verifyPayment(input: VerifyInput): Promise<boolean>;
  /** Verifies and parses a server-to-server webhook. Returns null when the signature is invalid. */
  parseWebhook?(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
  refund(input: { providerPaymentId: string; amount: number; reason?: string }): Promise<{ refundId: string }>;
}
