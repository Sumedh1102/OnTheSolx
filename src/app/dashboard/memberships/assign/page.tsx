import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatMoney } from "@/lib/format";
import { param } from "@/lib/url";
import { assignMembership } from "@/server/actions/memberships";
import { requirePermission } from "@/server/auth/guards";
import { getAllPlans } from "@/server/queries/memberships";
import { getStudentOptions } from "@/server/queries/students";

export const metadata = { title: "Assign membership" };

export default async function AssignMembershipPage({ searchParams }: PageProps<"/dashboard/memberships/assign">) {
  await requirePermission("memberships:manage");
  const sp = await searchParams;
  const [students, plans] = await Promise.all([getStudentOptions(), getAllPlans()]);
  return (
    <>
      <PageHeader
        title="Assign or renew membership"
        breadcrumbs={[{ label: "Memberships", href: "/dashboard/memberships" }, { label: "Assign" }]}
        description="Renewals start the day after the current membership ends, so no days are lost."
      />
      <Card className="max-w-2xl">
        <CardBody className="p-6">
          <ActionForm action={assignMembership} className="grid gap-4" successHref="/dashboard/memberships">
            <SelectField name="studentId" label="Student" required defaultValue={param(sp.student)} placeholder="Choose a student…" options={students.map((s) => ({ value: s.id, label: `${s.name} · ${s.studentCode}` }))} />
            <SelectField name="planId" label="Plan" required options={plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} — ${formatMoney(p.price)} (${p.durationMonths} mo)` }))} />
            <TextField name="startDate" label="Start date" type="date" hint="Leave blank to start today, or right after the current term" />
            <SelectField
              name="method"
              label="Payment"
              options={[
                { value: "UPI", label: "Paid — UPI" },
                { value: "CASH", label: "Paid — Cash" },
                { value: "CARD", label: "Paid — Card" },
                { value: "BANK_TRANSFER", label: "Paid — Bank transfer" },
                { value: "UNPAID", label: "Not paid yet (pending)" },
              ]}
            />
            <TextField name="notes" label="Notes" />
            <SubmitButton size="lg">Save membership</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
