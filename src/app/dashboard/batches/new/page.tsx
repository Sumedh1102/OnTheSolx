import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { todayInTz } from "@/lib/time";
import { createBatch } from "@/server/actions/batches";
import { requirePermission } from "@/server/auth/guards";
import { getProgramOptions } from "@/server/queries/batches";
import { getCourtOptions } from "@/server/queries/bookings";
import { getCoachOptions } from "@/server/queries/students";
import { BatchForm } from "../_components/batch-form";

export const metadata = { title: "Add batch" };

export default async function NewBatchPage() {
  await requirePermission("batches:manage");
  const [coaches, courts, programs] = await Promise.all([getCoachOptions(), getCourtOptions(), getProgramOptions()]);
  return (
    <>
      <PageHeader title="Add batch" breadcrumbs={[{ label: "Batches", href: "/dashboard/batches" }, { label: "New" }]} description="Court clashes with other batches are blocked automatically." />
      <Card className="max-w-3xl">
        <CardBody className="p-6">
          <BatchForm action={createBatch} defaults={{ startDate: todayInTz() }} coaches={coaches} courts={courts} programs={programs} submitLabel="Create batch" />
        </CardBody>
      </Card>
    </>
  );
}
