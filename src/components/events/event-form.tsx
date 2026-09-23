import { ActionForm, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import { minutesToHHMM } from "@/lib/time";
import type { ActionResult } from "@/server/actions/result";

export function EventForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults: {
    name?: string;
    category?: string;
    summary?: string;
    description?: string;
    date?: string;
    endDate?: string | null;
    startMinute?: number;
    endMinute?: number | null;
    venue?: string;
    fee?: number;
    registrationLimit?: number | null;
    registrationDeadline?: string | null;
    divisions?: string[];
    format?: string | null;
    status?: string;
  };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <TextField name="name" label="Event name" required defaultValue={defaults.name} className="md:col-span-2" />
      <SelectField name="category" label="Category" defaultValue={defaults.category ?? "TOURNAMENT"} options={["TOURNAMENT", "WORKSHOP", "CAMP", "SOCIAL", "TRIAL"].map((c) => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() }))} />
      <SelectField name="status" label="Status" defaultValue={defaults.status ?? "DRAFT"} options={[{ value: "DRAFT", label: "Draft (hidden)" }, { value: "PUBLISHED", label: "Published" }, { value: "CANCELLED", label: "Cancelled" }, { value: "COMPLETED", label: "Completed" }]} />
      <TextField name="summary" label="One-line summary" defaultValue={defaults.summary} className="md:col-span-2" />
      <TextareaField name="description" label="Description" rows={6} required defaultValue={defaults.description} className="md:col-span-2" />
      <TextField name="date" label="Date" type="date" required defaultValue={defaults.date} />
      <TextField name="endDate" label="End date (multi-day)" type="date" defaultValue={defaults.endDate} />
      <TextField name="startTime" label="Start time" type="time" required defaultValue={defaults.startMinute !== undefined ? minutesToHHMM(defaults.startMinute) : "08:00"} />
      <TextField name="endTime" label="End time" type="time" defaultValue={defaults.endMinute != null ? minutesToHHMM(defaults.endMinute) : ""} />
      <TextField name="venue" label="Venue" defaultValue={defaults.venue ?? "SmashPoint Arena, Palghar"} className="md:col-span-2" />
      <TextField name="fee" label="Registration fee (₹)" type="number" min={0} defaultValue={(defaults.fee ?? 0) / 100} hint="0 = free" />
      <TextField name="registrationLimit" label="Registration limit" type="number" min={1} defaultValue={defaults.registrationLimit ?? ""} hint="Blank = unlimited" />
      <TextField name="registrationDeadline" label="Registration deadline" type="date" defaultValue={defaults.registrationDeadline} />
      <SelectField name="format" label="Tournament format" defaultValue={defaults.format ?? ""} placeholder="Not a tournament" options={[{ value: "KNOCKOUT", label: "Knockout" }, { value: "ROUND_ROBIN", label: "Round robin" }, { value: "LEAGUE", label: "League" }]} hint="Ready for brackets & results" />
      <TextareaField name="divisions" label="Categories / divisions" rows={4} hint="One per line, e.g. U-13 Boys Singles" defaultValue={defaults.divisions?.join("\n")} className="md:col-span-2" />
      <div className="md:col-span-2">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
