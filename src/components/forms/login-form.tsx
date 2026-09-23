"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { login } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";

const DEMO = [
  { role: "Admin", email: "admin@smashpoint.in" },
  { role: "Manager", email: "manager@smashpoint.in" },
  { role: "Coach", email: "coach@smashpoint.in" },
  { role: "Reception", email: "reception@smashpoint.in" },
  { role: "Student", email: "student@smashpoint.in" },
  { role: "Parent", email: "parent@smashpoint.in" },
];

export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const [state, action, pending] = useActionState(login, null);
  const form = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <>
      <form ref={form} onSubmit={submitWithoutReset(action)} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email" error={errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus aria-invalid={!!errors?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors?.password} />
        </Field>
        <Link href="/forgot-password" className="-mt-2 justify-self-end text-sm font-bold underline hover:text-brand">
          Forgot password?
        </Link>
        {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
        <Button type="submit" size="lg" loading={pending} icon={<LogIn className="size-4" />}>
          Sign in
        </Button>
        <p className="text-center text-sm text-muted">
          New to SmashPoint?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-bold text-ink underline hover:text-brand">
            Create an account
          </Link>
        </p>
      </form>
      {showDemo ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-ink/50 bg-white/70 p-4">
          <p className="text-sm font-extrabold">Demo accounts</p>
          <p className="mb-3 text-xs text-muted">
            Password for all: <code className="rounded bg-paper-2 px-1 font-mono font-bold">SmashPoint@123</code>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="rounded-lg border-2 border-ink bg-white px-2 py-1.5 text-xs font-bold hover:bg-brand hover:text-white"
                onClick={() => {
                  const f = form.current;
                  if (!f) return;
                  (f.elements.namedItem("email") as HTMLInputElement).value = d.email;
                  (f.elements.namedItem("password") as HTMLInputElement).value = "SmashPoint@123";
                  f.requestSubmit();
                }}
              >
                {d.role}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
