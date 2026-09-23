import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { todayInTz } from "@/lib/time";
import { createStudent } from "@/server/actions/students";
import { requirePermission } from "@/server/auth/guards";
import { getBatchOptions, getCoachOptions } from "@/server/queries/students";
import { StudentForm } from "../_components/student-form";

export const metadata = { title: "Add student" };

export default async function NewStudentPage() {
  await requirePermission("students:manage");
  const [coaches, batches] = await Promise.all([getCoachOptions(), getBatchOptions()]);
  return (
    <>
      <PageHeader title="Add student" breadcrumbs={[{ label: "Students", href: "/dashboard/students" }, { label: "New" }]} description="A student code and check-in QR are generated automatically." />
      <Card className="max-w-4xl">
        <CardBody className="p-6">
          <StudentForm action={createStudent} coaches={coaches} batches={batches} defaults={{ joiningDate: todayInTz() }} submitLabel="Create student" />
        </CardBody>
      </Card>
    </>
  );
}
