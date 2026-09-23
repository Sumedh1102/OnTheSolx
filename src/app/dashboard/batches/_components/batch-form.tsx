import { ActionForm, CheckboxField, DaysField, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { minutesToHHMM } from "@/lib/time";
import type { ActionResult } from "@/server/actions/result";

export function BatchForm({
  action,
  defaults,
  coaches,
  courts,
  programs,
  submitLabel,
  showActive,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults: { name?: string; programId?: string | null; coachId?: string | null; courtId?: string | null; daysOfWeek?: number[]; startMinute?: number; endMinute?: number; capacity?: number; monthlyFee?: number; level?: string; startDate?: string; isActive?: boolean };
  coaches: { id: string; name: string }[];
  courts: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  submitLabel: string;
  showActive?: boolean;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <TextField name="name" label="Batch name" required defaultValue={defaults.name} placeholder="e.g. Advanced Morning Batch" className="md:col-span-2" />
      <SelectField name="programId" label="Program" defaultValue={defaults.programId} placeholder="—" options={programs.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField name="level" label="Level" defaultValue={defaults.level ?? "BEGINNER"} options={["BEGINNER", "INTERMEDIATE", "ADVANCED", "KIDS"].map((l) => ({ value: l, label: l.charAt(0) + l.slice(1).toLowerCase() }))} />
      <SelectField name="coachId" label="Coach" defaultValue={defaults.coachId} placeholder="Unassigned" options={coaches.map((c) => ({ value: c.id, label: c.name }))} />
      <SelectField name="courtId" label="Court" defaultValue={defaults.courtId} placeholder="No court (off-court session)" options={courts.map((c) => ({ value: c.id, label: c.name }))} hint="The court is reserved from public booking at these times" />
      <div className="md:col-span-2">
        <DaysField label="Days" defaultValue={defaults.daysOfWeek ?? [1, 2, 3, 4, 5, 6]} />
      </div>
      <TextField name="startTime" label="Start time" type="time" required defaultValue={defaults.startMinute !== undefined ? minutesToHHMM(defaults.startMinute) : "06:00"} />
      <TextField name="endTime" label="End time" type="time" required defaultValue={defaults.endMinute !== undefined ? minutesToHHMM(defaults.endMinute) : "08:00"} />
      <TextField name="capacity" label="Maximum capacity" type="number" min={1} defaultValue={defaults.capacity ?? 12} />
      <TextField name="monthlyFee" label="Monthly fee (₹)" type="number" min={0} defaultValue={(defaults.monthlyFee ?? 0) / 100} />
      <TextField name="startDate" label="Start date" type="date" defaultValue={defaults.startDate} />
      {showActive ? <CheckboxField name="isActive" label="Batch is active" description="Inactive batches free up their court slots" defaultChecked={defaults.isActive ?? true} /> : null}
      <div className="md:col-span-2">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
