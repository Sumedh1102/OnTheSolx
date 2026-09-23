import { addDays, dayOfWeek } from "./time";

export type ScheduleBatch = { id: string; name: string; daysOfWeek: number[]; startMinute: number; endMinute: number; isActive?: boolean };

/** Expands weekly batch schedules into dated sessions over a window. */
export function upcomingSessions<T extends ScheduleBatch>(batches: T[], fromDate: string, days: number, nowMinute: number | null = null) {
  const out: { date: string; batch: T }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const dow = dayOfWeek(date);
    for (const b of batches) {
      if (b.isActive === false || !b.daysOfWeek.includes(dow)) continue;
      if (i === 0 && nowMinute !== null && b.endMinute <= nowMinute) continue;
      out.push({ date, batch: b });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.batch.startMinute - b.batch.startMinute : a.date < b.date ? -1 : 1));
}
