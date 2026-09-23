import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, WebhookEvent } from "../types";

/**
 * Razorpay adapter (Orders API + Checkout.js). Configure RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET, then set PAYMENT_PROVIDER=razorpay.
 * Docs: https://razorpay.com/docs/payments/server-integration/nodejs/
 */
const API = "https://api.razorpay.com/v1";

function creds() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  return { keyId, keySecret, auth: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` };
}

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: creds().auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Razorpay ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const razorpayProvider: PaymentProvider = {
  id: "razorpay",
  displayName: "Razorpay",

  async createOrder(input) {
    const order = await call<{ id: string }>("/orders", {
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: { ...input.notes, payment_id: input.paymentId },
    });
    return {
      orderId: order.id,
      checkout: {
        kind: "razorpay",
        keyId: creds().keyId,
        orderId: order.id,
        amount: input.amount,
        currency: input.currency,
        name: "SmashPoint Badminton Academy",
        description: input.description,
        prefill: {
          name: input.customer.name,
          email: input.customer.email ?? undefined,
          contact: input.customer.phone ?? undefined,
        },
      },
    };
  },

  async verifyPayment({ orderId, providerPaymentId, signature }) {
    const expected = createHmac("sha256", creds().keySecret).update(`${orderId}|${providerPaymentId}`).digest("hex");
    return safeEqualHex(expected, signature);
  },

  async parseWebhook(rawBody, headers) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = headers.get("x-razorpay-signature");
    if (!secret || !signature) return null;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqualHex(expected, signature)) return null;

    const body = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string; error_description?: string } } };
    };
    const payment = body.payload?.payment?.entity;
    if (!payment?.order_id) return { type: "ignored" };
    if (body.event === "payment.captured" || body.event === "order.paid") {
      return { type: "payment.captured", orderId: payment.order_id, providerPaymentId: payment.id } satisfies WebhookEvent;
    }
    if (body.event === "payment.failed") {
      return { type: "payment.failed", orderId: payment.order_id, providerPaymentId: payment.id, reason: payment.error_description };
    }
    return { type: "ignored" };
  },

  async refund({ providerPaymentId, amount, reason }) {
    const refund = await call<{ id: string }>(`/payments/${providerPaymentId}/refund`, { amount, notes: { reason: reason ?? "" } });
    return { refundId: refund.id };
  },
};
