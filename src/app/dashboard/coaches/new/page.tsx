import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { createCoach } from "@/server/actions/coaches";
import { requirePermission } from "@/server/auth/guards";
import { CoachForm } from "../_components/coach-form";

export const metadata = { title: "Add coach" };

export default async function NewCoachPage() {
  await requirePermission("coaches:manage");
  return (
    <>
      <PageHeader title="Add coach" breadcrumbs={[{ label: "Coaches", href: "/dashboard/coaches" }, { label: "New" }]} description="Creates a coach login and a public profile." />
      <Card className="max-w-4xl">
        <CardBody className="p-6">
          <CoachForm action={createCoach} withAccount submitLabel="Create coach" />
        </CardBody>
      </Card>
    </>
  );
}
