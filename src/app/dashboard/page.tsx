import { FormMessage } from "@/components/ui/form";
import { isStaff } from "@/lib/rbac";
import { requireUser } from "@/server/auth/guards";
import { AdminDashboard } from "./_components/admin-dashboard";
import { CoachDashboard } from "./_components/coach-dashboard";
import { StudentDashboard } from "./_components/student-dashboard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await searchParams;
  const denied = sp.denied ? (
    <div className="mb-6">
      <FormMessage>You don&apos;t have access to that page.</FormMessage>
    </div>
  ) : null;

  if (user.role === "COACH") return (<>{denied}<CoachDashboard user={user} /></>);
  if (isStaff(user.role)) return (<>{denied}<AdminDashboard user={user} /></>);
  return (<>{denied}<StudentDashboard user={user} studentParam={sp.student} /></>);
}
