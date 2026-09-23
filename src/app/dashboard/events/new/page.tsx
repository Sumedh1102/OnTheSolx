import { EventForm } from "@/components/events/event-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { addDays, todayInTz } from "@/lib/time";
import { createEvent } from "@/server/actions/events";
import { requirePermission } from "@/server/auth/guards";

export const metadata = { title: "Create event" };

export default async function NewEventPage() {
  await requirePermission("events:manage");
  return (
    <>
      <PageHeader title="Create event" breadcrumbs={[{ label: "Events", href: "/dashboard/events" }, { label: "New" }]} description="Published events appear on the website and members get a notification." />
      <Card className="max-w-4xl">
        <CardBody className="p-6">
          <EventForm action={createEvent} defaults={{ date: addDays(todayInTz(), 14) }} submitLabel="Create event" />
        </CardBody>
      </Card>
    </>
  );
}
