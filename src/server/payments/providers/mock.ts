import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "../types";

/**
 * Sandbox provider used in development and demos. It behaves like a real gateway:
 * orders are created server-side, the customer completes payment on a hosted page
 * (/checkout/mock/[paymentId]) and success is proven with an HMAC signature that the
 * server verifies — exactly the same capture path a real provider uses.
 */
function secret() {
  return `mock-gateway:${process.env.AUTH_SECRET ?? "dev"}`;
}

export function mockSignature(orderId: string, providerPaymentId: string) {
  return createHmac("sha256", secret()).update(`${orderId}|${providerPaymentId}`).digest("hex");
}

export const mockProvider: PaymentProvider = {
  id: "mock",
  displayName: "SmashPay Sandbox",

  async createOrder(input) {
    const orderId = `mock_order_${randomBytes(9).toString("hex")}`;
    return { orderId, checkout: { kind: "redirect", url: `/checkout/mock/${input.paymentId}` } };
  },

  async verifyPayment({ orderId, providerPaymentId, signature }) {
    const expected = Buffer.from(mockSignature(orderId, providerPaymentId));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  },

  async refund() {
    return { refundId: `mock_rfnd_${randomBytes(8).toString("hex")}` };
  },
};
