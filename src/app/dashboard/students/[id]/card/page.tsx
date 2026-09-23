import { notFound } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { PrintButton } from "@/components/admin/print-button";
import { formatDate, titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/guards";
import { studentQrSvg } from "@/server/qr";
import { getStudentProfile } from "@/server/queries/student";
import { site } from "@/content/site";

export const metadata = { title: "Student ID card" };

export default async function StudentCardPage({ params }: PageProps<"/dashboard/students/[id]/card">) {
  await requirePermission("students:manage");
  const { id } = await params;
  const profile = await getStudentProfile(id);
  if (!profile) notFound();
  const s = profile.student;
  const svg = await studentQrSvg(s.qrToken);
  return (
    <div className="grid place-items-center gap-6 py-6">
      <div className="w-[340px] overflow-hidden rounded-3xl border-3 border-ink bg-white shadow-brutal-lg print:shadow-none">
        <div className="grid-paper-blue flex items-center gap-3 border-b-3 border-ink px-5 py-4 text-white">
          <LogoMark className="bg-white" />
          <div>
            <p className="font-display text-lg font-extrabold leading-none">{site.shortName}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Student ID</p>
          </div>
        </div>
        <div className="p-5 text-center">
          <p className="font-display text-2xl font-extrabold">{s.name}</p>
          <p className="font-mono text-sm font-bold text-muted">{s.studentCode}</p>
          <div className="mx-auto mt-4 w-48 rounded-xl border-2 border-ink p-1.5" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-4 flex justify-between text-xs font-bold">
            <span>{titleCase(s.level)}</span>
            <span>Since {formatDate(s.joiningDate)}</span>
          </div>
        </div>
      </div>
      <PrintButton />
    </div>
  );
}
