import { ActionForm, CheckboxField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import type { ActionResult } from "@/server/actions/result";

export function CoachForm({
  action,
  defaults = {},
  withAccount,
  submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults?: {
    name?: string;
    email?: string;
    phone?: string | null;
    title?: string;
    experienceYears?: number;
    specialization?: string;
    certifications?: string[];
    achievements?: string[];
    bio?: string;
    isPublic?: boolean;
    sortOrder?: number;
  };
  withAccount?: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <TextField name="name" label="Full name" required defaultValue={defaults.name} />
      <TextField name="phone" label="Phone" type="tel" required defaultValue={defaults.phone} />
      {withAccount ? (
        <>
          <TextField name="email" label="Login email" type="email" required defaultValue={defaults.email} />
          <TextField name="password" label="Temporary password" type="password" required hint="Share securely; they can change it in Profile" />
        </>
      ) : null}
      <TextField name="title" label="Role / title" required defaultValue={defaults.title} placeholder="e.g. Senior Coach · Footwork" />
      <TextField name="experienceYears" label="Experience (years)" type="number" min={0} defaultValue={defaults.experienceYears ?? 0} />
      <TextField name="specialization" label="Specialization" required defaultValue={defaults.specialization} className="md:col-span-2" />
      <TextareaField name="certifications" label="Certifications" rows={3} hint="One per line" defaultValue={defaults.certifications?.join("\n")} />
      <TextareaField name="achievements" label="Achievements" rows={3} hint="One per line" defaultValue={defaults.achievements?.join("\n")} />
      <TextareaField name="bio" label="Short biography" rows={4} defaultValue={defaults.bio} className="md:col-span-2" />
      <CheckboxField name="isPublic" label="Show on the public Coaches page" defaultChecked={defaults.isPublic ?? true} />
      <TextField name="sortOrder" label="Display order" type="number" defaultValue={defaults.sortOrder ?? 0} />
      <div className="md:col-span-2">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
