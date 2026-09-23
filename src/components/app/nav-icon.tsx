import {
  Bell,
  BookOpenCheck,
  CalendarCheck2,
  ChartColumnBig,
  ClipboardCheck,
  CreditCard,
  Gauge,
  IdCard,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  ScanLine,
  Settings,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  Whistle,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "./nav-config";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  courts: LayoutGrid,
  bookings: CalendarCheck2,
  coaches: Whistle,
  batches: UsersRound,
  attendance: ClipboardCheck,
  performance: Gauge,
  memberships: IdCard,
  membership: IdCard,
  payments: CreditCard,
  events: Trophy,
  announcements: Megaphone,
  reports: ChartColumnBig,
  settings: Settings,
  profile: UserRound,
  notifications: Bell,
  scan: ScanLine,
  enquiries: Inbox,
};

export function NavIcon({ name, className }: { name: IconKey; className?: string }) {
  const Icon = ICONS[name] ?? BookOpenCheck;
  return <Icon className={className} strokeWidth={2.4} aria-hidden />;
}
