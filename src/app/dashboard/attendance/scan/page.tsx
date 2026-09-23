import { QrScanner } from "@/components/attendance/qr-scanner";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatTimeRange } from "@/lib/format";
import { todayInTz } from "@/lib/time";
import { requirePermission } from "@/server/auth/guards";
import { getBatchesOn } from "@/server/queries/admin";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "QR check-in" };

export default async function ScanPage() {
  const user = await requirePermission("attendance:scan");
  const coach = user.role === "COACH" ? await getCoachForUser(user.id) : null;
  const batches = await getBatchesOn(todayInTz(), coach?.id);
  return (
    <>
      <PageHeader
        title="QR check-in"
        breadcrumbs={[{ label: "Attendance", href: "/dashboard/attendance" }, { label: "QR check-in" }]}
        description="Students show their QR code; the scan verifies identity and marks attendance. Scanning twice never creates a duplicate."
      />
      {batches.length ? (
        <QrScanner batches={batches.map((b) => ({ id: b.id, label: `${b.name} · ${formatTimeRange(b.startMinute, b.endMinute)}` }))} />
      ) : (
        <EmptyState title="No batches today" description="QR check-in is available on days a batch is scheduled." />
      )}
    </>
  );
}
