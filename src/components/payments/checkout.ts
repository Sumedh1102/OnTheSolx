"use client";

import type { CheckoutInstruction } from "@/server/payments/types";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (res: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment gateway"));
    document.body.appendChild(s);
  });
}

/**
 * Executes the provider-agnostic checkout instruction returned by the server.
 * Redirect-based providers navigate away; SDK-based providers (Razorpay) open their modal
 * and hand the signed result back to /api/payments/verify for server-side verification.
 */
export async function runCheckout(instruction: CheckoutInstruction, handlers: { onError: (message: string) => void }) {
  if (instruction.kind === "redirect") {
    window.location.assign(instruction.url);
    return;
  }
  if (instruction.kind === "razorpay") {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!window.Razorpay) throw new Error("Payment gateway unavailable");
    const rzp = new window.Razorpay({
      key: instruction.keyId,
      order_id: instruction.orderId,
      amount: instruction.amount,
      currency: instruction.currency,
      name: instruction.name,
      description: instruction.description,
      prefill: instruction.prefill,
      theme: { color: "#1f47ff" },
      handler: async (res: RazorpayResponse) => {
        const r = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "razorpay", orderId: res.razorpay_order_id, paymentId: res.razorpay_payment_id, signature: res.razorpay_signature }),
        });
        const json = (await r.json()) as { redirect?: string; error?: string };
        if (r.ok && json.redirect) window.location.assign(json.redirect);
        else handlers.onError(json.error ?? "Payment verification failed");
      },
      modal: { ondismiss: () => handlers.onError("Payment window closed. Your slot is held for a few minutes — try again.") },
    });
    rzp.on("payment.failed", (res) => {
      void fetch("/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "razorpay", orderId: instruction.orderId, reason: res.error?.description }),
      });
      handlers.onError(res.error?.description ?? "Payment failed");
    });
    rzp.open();
  }
}
