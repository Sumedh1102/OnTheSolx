import { can, type Permission, type Role } from "@/lib/rbac";

export type IconKey =
  | "dashboard"
  | "students"
  | "courts"
  | "bookings"
  | "coaches"
  | "batches"
  | "attendance"
  | "performance"
  | "memberships"
  | "payments"
  | "events"
  | "announcements"
  | "reports"
  | "settings"
  | "profile"
  | "membership"
  | "notifications"
  | "scan"
  | "enquiries";

export type NavItem = { href: string; label: string; icon: IconKey; group?: string };

type Rule = NavItem & { permission?: Permission; roles?: Role[] };

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "attendance" },
  { href: "/dashboard/membership", label: "Membership", icon: "membership" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile" },
];

const STAFF_NAV: Rule[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Overview" },
  { href: "/dashboard/students", label: "Students", icon: "students", permission: "students:view", group: "Academy" },
  { href: "/dashboard/coaches", label: "Coaches", icon: "coaches", permission: "coaches:view", group: "Academy" },
  { href: "/dashboard/batches", label: "Batches", icon: "batches", permission: "batches:view", group: "Academy" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "attendance", permission: "attendance:view", group: "Academy" },
  { href: "/dashboard/performance", label: "Performance", icon: "performance", permission: "performance:manage", group: "Academy" },
  { href: "/dashboard/courts", label: "Courts", icon: "courts", permission: "courts:view", group: "Courts" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings", permission: "bookings:manage", group: "Courts" },
  { href: "/dashboard/memberships", label: "Memberships", icon: "memberships", permission: "memberships:view", group: "Business" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments", permission: "payments:view", group: "Business" },
  { href: "/dashboard/events", label: "Events", icon: "events", permission: "events:manage", group: "Business" },
  { href: "/dashboard/announcements", label: "Announcements", icon: "announcements", permission: "announcements:manage", group: "Business" },
  { href: "/dashboard/enquiries", label: "Enquiries", icon: "enquiries", permission: "enquiries:view", group: "Business" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", permission: "reports:view", group: "Business" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", permission: "settings:manage", group: "System" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile", group: "System" },
];

export function navFor(role: Role): NavItem[] {
  if (role === "STUDENT") return STUDENT_NAV;
  return STAFF_NAV.filter((i) => (!i.permission || can(role, i.permission)) && (!i.roles || i.roles.includes(role))).map(({ permission: _p, roles: _r, ...rest }) => rest);
}

/** Up to four destinations for the mobile bottom bar (plus a "More" drawer for staff). */
export function mobileNavFor(role: Role): NavItem[] {
  const items = navFor(role);
  if (role === "STUDENT") return items;
  const priority = ["/dashboard", "/dashboard/bookings", "/dashboard/attendance", "/dashboard/students", "/dashboard/batches", "/dashboard/payments"];
  return priority.map((h) => items.find((i) => i.href === h)).filter((i): i is NavItem => !!i).slice(0, 4);
}
