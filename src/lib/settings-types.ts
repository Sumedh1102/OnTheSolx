/** Shapes of the JSON documents stored in the `settings` table, with defaults. */

export type PeakWindow = {
  label: string;
  startMinute: number;
  endMinute: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
};

export type BookingSettings = {
  timezone: string;
  openMinute: number;
  closeMinute: number;
  durations: number[];
  defaultDuration: number;
  peakWindows: PeakWindow[];
  /** How long an unpaid booking holds its slot. */
  holdMinutes: number;
  /** How many days ahead customers can book online. */
  advanceDays: number;
  /** Customers may cancel online until this many hours before start. */
  cancellationCutoffHours: number;
  /** Allow bookings without an account (name + phone + email). */
  allowGuestBooking: boolean;
};

export type AcademySettings = {
  name: string;
  shortName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  mapQuery: string;
  openingHours: string;
  socials: { instagram: string; youtube: string; facebook: string; x: string };
};

export type NotificationSettings = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  bookingReminderHours: number;
  membershipExpiryReminderDays: number;
};

export type AttendanceSettings = {
  /** Minutes after batch start when a QR check-in is marked LATE. */
  lateAfterMinutes: number;
  qrEnabled: boolean;
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timezone: "Asia/Kolkata",
  openMinute: 4 * 60,
  closeMinute: 19 * 60,
  durations: [30, 60, 90],
  defaultDuration: 60,
  peakWindows: [{ label: "Evening peak", startMinute: 17 * 60, endMinute: 19 * 60, days: [0, 1, 2, 3, 4, 5, 6] }],
  holdMinutes: 10,
  advanceDays: 14,
  cancellationCutoffHours: 6,
  allowGuestBooking: true,
};

export const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  name: "SmashPoint Badminton Academy",
  shortName: "SmashPoint",
  tagline: "Train sharper. Play faster. Book in seconds.",
  phone: "+91 98220 41190",
  whatsapp: "+91 98220 41190",
  email: "hello@smashpoint.in",
  addressLine: "Plot 14, Mahim Road, near Hutatma Stambh",
  city: "Palghar",
  state: "Maharashtra",
  postalCode: "401404",
  mapQuery: "Mahim Road, Palghar, Maharashtra 401404",
  openingHours: "Mon – Sun · 4:00 AM – 7:00 PM",
  socials: {
    instagram: "https://instagram.com/smashpoint.academy",
    youtube: "https://youtube.com/@smashpointacademy",
    facebook: "https://facebook.com/smashpointacademy",
    x: "https://x.com/smashpointhq",
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  sms: false,
  whatsapp: false,
  bookingReminderHours: 12,
  membershipExpiryReminderDays: 7,
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateAfterMinutes: 10,
  qrEnabled: true,
};
