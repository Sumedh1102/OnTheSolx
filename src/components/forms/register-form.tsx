"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { register } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, RadioCards } from "@/components/ui/form";

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(register, null);
  const [type, setType] = useState<"player" | "parent">("player");
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <RadioCards
        name="accountType"
        value={type}
        onChange={setType}
        className="grid-cols-2"
        options={[
          { value: "player", label: "I'm a player", description: "Booking & training for myself" },
          { value: "parent", label: "I'm a parent", description: "Managing my child's training" },
        ]}
      />
      <Field label={type === "parent" ? "Your name" : "Full name"} htmlFor="name" error={errors?.name} required>
        <Input id="name" name="name" autoComplete="name" aria-invalid={!!errors?.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errors?.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!errors?.email} />
        </Field>
        <Field label="Mobile" htmlFor="phone" error={errors?.phone} required>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors?.phone} />
        </Field>
      </div>
      {type === "parent" ? (
        <div className="grid gap-4 rounded-2xl border-2 border-ink bg-brand-50 p-4 sm:grid-cols-2">
          <Field label="Child's name" htmlFor="childName" error={errors?.childName} required>
            <Input id="childName" name="childName" aria-invalid={!!errors?.childName} />
          </Field>
          <Field label="Child's date of birth" htmlFor="childDob" error={errors?.childDob} required>
            <Input id="childDob" name="childDob" type="date" aria-invalid={!!errors?.childDob} />
          </Field>
        </div>
      ) : null}
      <Field label="Password" htmlFor="password" error={errors?.password} hint="8+ characters with at least one number" required>
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors?.password} />
      </Field>
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" loading={pending} icon={<UserPlus className="size-4" />}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-bold text-ink underline hover:text-brand">
          Sign in
        </Link>
      </p>
    </form>
  );
}
