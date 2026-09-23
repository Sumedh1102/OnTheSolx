import { ActionForm, CheckboxField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import type { ActionResult } from "@/server/actions/result";

export function PlanForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults: { name?: string; description?: string; durationMonths?: number; price?: number; trainingAccess?: string; benefits?: string[]; courtDiscountPercent?: number; isFeatured?: boolean; isActive?: boolean; sortOrder?: number };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-2">
      <TextField name="name" label="Plan name" required defaultValue={defaults.name} />
      <TextField name="durationMonths" label="Duration (months)" type="number" min={1} defaultValue={defaults.durationMonths ?? 1} />
      <TextField name="price" label="Price (₹)" type="number" min={0} defaultValue={(defaults.price ?? 0) / 100} />
      <TextField name="courtDiscountPercent" label="Court booking discount (%)" type="number" min={0} max={50} defaultValue={defaults.courtDiscountPercent ?? 0} />
      <TextField name="trainingAccess" label="Training access" required defaultValue={defaults.trainingAccess} placeholder="e.g. 1 batch · up to 4 sessions/week" className="md:col-span-2" />
      <TextField name="description" label="Short description" defaultValue={defaults.description} className="md:col-span-2" />
      <TextareaField name="benefits" label="Benefits" hint="One per line" rows={4} defaultValue={defaults.benefits?.join("\n")} className="md:col-span-2" />
      <TextField name="sortOrder" label="Display order" type="number" defaultValue={defaults.sortOrder ?? 0} />
      <div className="grid content-end gap-2">
        <CheckboxField name="isFeatured" label="Highlight as most popular" defaultChecked={defaults.isFeatured} />
        <CheckboxField name="isActive" label="Available for purchase" defaultChecked={defaults.isActive ?? true} />
      </div>
      <div className="md:col-span-2">
        <SubmitButton variant="dark">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
