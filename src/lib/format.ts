import { WEEKDAYS_SHORT, parseISODate } from "./time";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Indian digit grouping (12,34,567) without Intl, so server and browser output always match. */
function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Formats minor units (paise) as rupees: 40000 → "₹400", 123450 → "₹1,234.50". */
export function formatMoney(minor: number, opts: { precise?: boolean } = {}): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  const frac = opts.precise || paise ? `.${String(paise).padStart(2, "0")}` : "";
  return `${sign}₹${groupIndian(rupees)}${frac}`;
}

export function monthShort(index: number) {
  return MONTHS_SHORT[index]!;
}

export function formatNumber(n: number): string {
  return `${n < 0 ? "-" : ""}${groupIndian(n)}`;
}

/** 1050 → "5:30 PM" */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 1050, 1110 → "5:30 – 6:30 PM" */
export function formatTimeRange(start: number, end: number): string {
  const a = formatMinutes(start);
  const b = formatMinutes(end);
  const [aTime, aSuffix] = a.split(" ");
  const [, bSuffix] = b.split(" ");
  return aSuffix === bSuffix ? `${aTime} – ${b}` : `${a} – ${b}`;
}

/** 1050 → "17:30" (compact 24h label for grids) */
export function formatMinutes24(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type DateStyle = "short" | "medium" | "long" | "weekday" | "dayMonth";

/** Formats an ISO calendar date (YYYY-MM-DD) deterministically (no locale data, no timezone drift). */
export function formatDate(iso: string | null | undefined, style: DateStyle = "medium"): string {
  if (!iso) return "—";
  const d = parseISODate(iso.slice(0, 10));
  const day = d.getUTCDate();
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  const wd = d.getUTCDay();
  switch (style) {
    case "short":
    case "dayMonth":
      return `${day} ${MONTHS_SHORT[m]}`;
    case "long":
      return `${WEEKDAYS_FULL[wd]}, ${day} ${MONTHS_LONG[m]} ${y}`;
    case "weekday":
      return `${WEEKDAYS_SHORT[wd]}, ${day} ${MONTHS_SHORT[m]}`;
    default:
      return `${day} ${MONTHS_SHORT[m]} ${y}`;
  }
}

/** Formats an instant in the academy timezone. */
export function formatDateTime(value: Date | string | null | undefined, tz = "Asia/Kolkata"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(value: Date | string, now = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDateTime(d);
}

export function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const key = sorted.join(",");
  if (key === "1,2,3,4,5,6") return "Mon – Sat";
  if (key === "1,2,3,4,5") return "Mon – Fri";
  if (key === "1,2,3,4,5,6,0") return "Every day";
  if (key === "6,0") return "Sat & Sun";
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(", ");
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h} hr${h > 1 ? "s" : ""}`;
}

export function ageFromDob(dob: string | null | undefined, todayIso: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  let age = ty! - y!;
  if (tm! < m! || (tm === m && td! < d!)) age--;
  return age;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
