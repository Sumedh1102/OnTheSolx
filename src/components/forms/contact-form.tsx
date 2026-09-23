"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { submitEnquiry } from "@/server/actions/public";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const TOPICS = ["General enquiry", "Coaching / Free trial", "Kids Program", "Court booking", "Membership", "Corporate booking", "Events & tournaments"];

export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [state, action, pending] = useActionState(submitEnquiry, null);
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Message sent", state.message);
      formRef.current?.reset();
    } else if (state && !state.ok && !state.fieldErrors) toast.error("Couldn't send", state.error);
  }, [state, toast]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" required error={errors?.name}>
          <Input id="c-name" name="name" autoComplete="name" aria-invalid={!!errors?.name} required />
        </Field>
        <Field label="Phone" htmlFor="c-phone" hint="Optional — we'll WhatsApp you" error={errors?.phone}>
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors?.phone} />
        </Field>
      </div>
      <Field label="Email" htmlFor="c-email" required error={errors?.email}>
        <Input id="c-email" name="email" type="email" autoComplete="email" aria-invalid={!!errors?.email} required />
      </Field>
      <Field label="Topic" htmlFor="c-subject" error={errors?.subject}>
        <Select id="c-subject" name="subject" defaultValue={defaultTopic ?? TOPICS[0]}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Message" htmlFor="c-message" required error={errors?.message}>
        <Textarea id="c-message" name="message" rows={5} aria-invalid={!!errors?.message} placeholder="Tell us about your level, preferred timings or questions…" required />
      </Field>
      {/* Honeypot for bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state?.ok ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <Button type="submit" size="lg" loading={pending}>
        Send message <Send className="size-4" />
      </Button>
    </form>
  );
}
