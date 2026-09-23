"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { requestPasswordReset, resetPassword } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-muted">Didn&apos;t get it? Check your spam folder, or ask the front desk to update the email on your account.</p>
        <Link href="/login" className="text-sm font-bold underline hover:text-brand">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submitWithoutReset(action)} className="grid gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus aria-invalid={!!errors?.email} />
      </Field>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" loading={pending} icon={<Mail className="size-4" />}>
        Email me a reset link
      </Button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-ink underline hover:text-brand">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={submitWithoutReset(action)} className="grid gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" hint="At least 8 characters, with letters and a number." error={errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus aria-invalid={!!errors?.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={!!errors?.confirm} />
      </Field>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" loading={pending} icon={<KeyRound className="size-4" />}>
        Set new password
      </Button>
    </form>
  );
}
