"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { runCheckout } from "@/components/payments/checkout";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { CheckoutInstruction } from "@/server/payments/types";

type Result = { ok: true; message?: string; data?: { checkout: CheckoutInstruction } } | { ok: false; error: string };

/** A form whose server action returns a provider-agnostic checkout instruction. */
export function CheckoutForm({ action, children, className }: { action: (prev: Result | null, fd: FormData) => Promise<Result>; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, null);
  const toast = useToast();
  useEffect(() => {
    if (!state) return;
    if (state.ok && state.data?.checkout) void runCheckout(state.data.checkout, { onError: (m) => toast.error("Payment not completed", m) });
    else if (!state.ok) toast.error("Couldn't start payment", state.error);
  }, [state, toast]);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <div className="mt-3">
          <FormMessage>{state.error}</FormMessage>
        </div>
      ) : null}
    </form>
  );
}
