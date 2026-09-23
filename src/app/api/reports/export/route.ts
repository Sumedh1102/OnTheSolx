import type { NextRequest } from "next/server";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { can } from "@/lib/rbac";
import { addDays, isValidISODate, todayInTz } from "@/lib/time";
import { formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { attendanceRecords, attendanceSessions, batches, bookings, courts, eventRegistrations, events, payments, students } from "@/server/db/schema";
import { toCsv, toXlsx, type Sheet } from "@/server/export/tabular";
import { bookingReport, coachReport, revenueReport, studentReport, type Period } from "@/server/queries/reports";

const rupees = (paise: number) => Math.round(paise) / 100;

async function buildSheets(report: string, from: string, to: string, period: Period, eventId: string | null): Promise<Sheet[] | null> {
  switch (report) {
    case "revenue": {
      const r = await revenueReport(from, to, period);
      return [
        {
          name: `Revenue (${period})`,
          columns: ["Period starting", "Payments", "Court bookings (₹)", "Memberships (₹)", "Events (₹)", "Other (₹)", "Total (₹)"],
          rows: r.series.map((s) => [s.bucket, s.count, rupees(s.BOOKING), rupees(s.MEMBERSHIP), rupees(s.EVENT), rupees(s.other), rupees(s.total)]),
        },
      ];
    }
    case "bookings": {
      const rows = await db
        .select({ code: bookings.code, date: bookings.date, start: bookings.startMinute, end: bookings.endMinute, court: courts.name, name: bookings.customerName, phone: bookings.customerPhone, email: bookings.customerEmail, status: bookings.status, source: bookings.source, subtotal: bookings.subtotal, discount: bookings.discount, total: bookings.total })
        .from(bookings)
        .innerJoin(courts, eq(courts.id, bookings.courtId))
        .where(and(gte(bookings.date, from), lte(bookings.date, to)))
        .orderBy(asc(bookings.date), asc(bookings.startMinute));
      const summary = await bookingReport(from, to);
      return [
        {
          name: "Bookings",
          columns: ["Booking ID", "Date", "Start", "End", "Court", "Customer", "Phone", "Email", "Status", "Source", "Subtotal (₹)", "Discount (₹)", "Total (₹)"],
          rows: rows.map((b) => [b.code, b.date, formatMinutes(b.start), formatMinutes(b.end), b.court, b.name, b.phone, b.email, b.status, b.source, rupees(b.subtotal), rupees(b.discount), rupees(b.total)]),
        },
        {
          name: "Summary",
          columns: ["Metric", "Value"],
          rows: [
            ["Total bookings", summary.total],
            ["Confirmed", summary.confirmed],
            ["Cancelled / refunded", summary.cancelled],
            ["Cancellation rate (%)", summary.cancellationRate],
            ["Hours booked", summary.hoursBooked],
            ["Peak start hour", summary.peakHour !== null ? formatMinutes(summary.peakHour * 60) : ""],
            ["Most used court", summary.mostUsedCourt ?? ""],
          ],
        },
        { name: "By court", columns: ["Court", "Bookings", "Hours", "Revenue (₹)"], rows: summary.byCourt.map((c) => [c.court, c.count, c.hours, rupees(c.revenue)]) },
      ];
    }
    case "payments": {
      const localDate = sql`(${payments.paidAt} AT TIME ZONE 'Asia/Kolkata')::date`;
      const rows = await db
        .select()
        .from(payments)
        .where(and(sql`${localDate} >= ${from}::date`, sql`${localDate} <= ${to}::date`))
        .orderBy(desc(payments.paidAt));
      return [
        {
          name: "Payments",
          columns: ["Receipt", "Paid at", "Payer", "Phone", "Email", "Purpose", "Method", "Provider", "Gateway ID", "Status", "Amount (₹)", "Refunded (₹)"],
          rows: rows.map((p) => [p.receiptNumber, p.paidAt?.toISOString() ?? "", p.payerName, p.payerPhone, p.payerEmail, p.purpose, p.method, p.provider, p.providerPaymentId, p.status, rupees(p.amount), rupees(p.refundedAmount)]),
        },
      ];
    }
    case "students": {
      const summary = await studentReport(from, to, todayInTz());
      const rows = await db
        .select({ code: students.studentCode, name: students.name, level: students.level, status: students.status, joined: students.joiningDate, phone: students.phone, email: students.email })
        .from(students)
        .orderBy(asc(students.name));
      return [
        { name: "Students", columns: ["Code", "Name", "Level", "Status", "Joined", "Phone", "Email"], rows: rows.map((s) => [s.code, s.name, s.level, s.status, s.joined, s.phone, s.email]) },
        {
          name: "Summary",
          columns: ["Metric", "Value"],
          rows: [
            ["Active students", summary.active],
            ["New students in range", summary.newStudents],
            ["Active memberships", summary.activeMemberships],
            ["Expired (not renewed) in range", summary.expiredMemberships],
            ["Attendance rate (%)", summary.attendancePct],
          ],
        },
      ];
    }
    case "attendance": {
      const rows = await db
        .select({ date: attendanceSessions.date, batch: batches.name, code: students.studentCode, name: students.name, status: attendanceRecords.status, source: attendanceRecords.source, remarks: attendanceRecords.remarks })
        .from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
        .innerJoin(batches, eq(batches.id, attendanceSessions.batchId))
        .innerJoin(students, eq(students.id, attendanceRecords.studentId))
        .where(and(gte(attendanceSessions.date, from), lte(attendanceSessions.date, to)))
        .orderBy(asc(attendanceSessions.date), asc(batches.name), asc(students.name));
      return [{ name: "Attendance", columns: ["Date", "Batch", "Student code", "Student", "Status", "Source", "Remarks"], rows: rows.map((r) => [r.date, r.batch, r.code, r.name, r.status, r.source, r.remarks]) }];
    }
    case "coaches": {
      const rows = await coachReport(from, to);
      return [
        {
          name: "Coaches",
          columns: ["Coach", "Title", "Active batches", "Sessions conducted", "Students assigned", "Attendance handled", "Attendance rate (%)"],
          rows: rows.map((c) => [c.name, c.title, c.batches, c.sessions, c.studentsAssigned, c.attendanceHandled, c.counted ? Math.round((c.attended / c.counted) * 100) : ""]),
        },
      ];
    }
    case "event-registrations": {
      if (!eventId) return null;
      const [event] = await db.select({ name: events.name }).from(events).where(eq(events.id, eventId));
      const rows = await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId)).orderBy(asc(eventRegistrations.createdAt));
      return [
        {
          name: (event?.name ?? "Registrations").slice(0, 31),
          columns: ["Participant", "Email", "Phone", "Category", "Status", "Payment", "Amount (₹)", "Registered at"],
          rows: rows.map((r) => [r.participantName, r.email, r.phone, r.division, r.status, r.paymentStatus, rupees(r.amount), r.createdAt.toISOString()]),
        },
      ];
    }
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const sp = req.nextUrl.searchParams;
  const report = sp.get("report") ?? "";
  const allowed = report === "event-registrations" ? can(user?.role, "events:manage") : can(user?.role, "reports:view");
  if (!user || !allowed) return new Response("Forbidden", { status: 403 });

  const today = todayInTz();
  const from = isValidISODate(sp.get("from") ?? "") ? sp.get("from")! : addDays(today, -29);
  const to = isValidISODate(sp.get("to") ?? "") ? sp.get("to")! : today;
  const period = (["daily", "weekly", "monthly", "yearly"].includes(sp.get("period") ?? "") ? sp.get("period") : "daily") as Period;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const eventId = sp.get("event");
  if (eventId && !/^[0-9a-f-]{36}$/i.test(eventId)) return new Response("Bad request", { status: 400 });

  const sheets = await buildSheets(report, from, to, period, eventId);
  if (!sheets) return new Response("Unknown report", { status: 400 });
  const filename = `smashpoint-${report}-${from}-to-${to}`;
  if (format === "xlsx") {
    return new Response(new Uint8Array(toXlsx(sheets)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(toCsv(sheets[0]!), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"`, "Cache-Control": "private, no-store" },
  });
}
