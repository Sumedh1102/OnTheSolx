/**
 * Demo data for SmashPoint: WIPES application tables and re-creates a realistic academy
 * (courts, coaches, batches, 72 students, ~4 months of bookings, payments, attendance,
 * performance scores, events and announcements). Used by `npm run db:seed` and by
 * `npm run db:deploy` when SEED_DEMO_DATA=true on an empty database.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../src/server/db/schema";
import { hashPassword } from "../../src/server/auth/password";
import { priceForRange } from "../../src/lib/booking/engine";
import { DEFAULT_ATTENDANCE_SETTINGS, DEFAULT_BOOKING_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS } from "../../src/lib/settings-types";
import { addDays, addMonths, dayOfWeek, nowMinutesInTz, rangesOverlap, todayInTz } from "../../src/lib/time";
import { COURTS, MEMBERSHIP_PLANS, PROGRAMS } from "./catalogue";

/** Settings key marking a database as holding demo data (the seed refuses to wipe anything else). */
export const DEMO_MARKER = "demo_data";

let db: NodePgDatabase<typeof schema>;
const s = schema;

/* ── deterministic randomness ─────────────────────────────────────────────── */
let seed = 20260923;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const code = (prefix: string, len = 6) => {
  const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) out += A[Math.floor(rand() * A.length)];
  return `${prefix}-${out}`;
};
const token = () => randomBytes(18).toString("base64url");
const rupees = (n: number) => n * 100;

async function chunkInsert<T>(table: Parameters<typeof db.insert>[0], rows: T[], size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

const TZ = DEFAULT_BOOKING_SETTINGS.timezone;
const TODAY = todayInTz(TZ);
const NOW_MIN = nowMinutesInTz(TZ);
/** An instant on a local date at a local minute (IST = UTC+5:30, no DST). */
const at = (date: string, minute: number) => new Date(new Date(`${date}T00:00:00+05:30`).getTime() + minute * 60_000);

const FIRST_M = ["Aarav", "Vihaan", "Ishaan", "Arjun", "Reyansh", "Atharva", "Shaurya", "Kabir", "Advait", "Om", "Parth", "Soham", "Yash", "Tanmay", "Rudra", "Aditya", "Harsh", "Pranav", "Sarthak", "Neel"];
const FIRST_F = ["Siya", "Anaya", "Myra", "Aadhya", "Kiara", "Ira", "Sanvi", "Mrunal", "Tanvi", "Gauri", "Riya", "Anvi", "Shravani", "Saanvi", "Pari", "Isha", "Janhavi", "Aarohi", "Rucha", "Diya"];
const LAST = ["Patil", "Sawant", "Joshi", "Kulkarni", "Deshmukh", "Pawar", "Chaudhari", "Raut", "Thakur", "Gawde", "Vartak", "Bhoir", "Mhatre", "Naik", "Save", "Shinde", "Jadhav", "Kadam", "More", "Churi"];
const AREAS = ["Mahim Road", "Station Road", "Tembhode", "Lokmanya Nagar", "Navli", "Boisar Road", "Kelwa Road", "Satpati Road", "Devisha Road", "Manor Road"];

const phone = () => `+91 ${pick(["98", "97", "93", "90", "88", "77"])}${int(100, 999)} ${int(10000, 99999)}`;

export async function seedDemo(database: NodePgDatabase<typeof schema>) {
  db = database;
  console.log(`🌱 Seeding SmashPoint demo data (today = ${TODAY} IST)…`);

  await db.execute(sql`TRUNCATE TABLE
    audit_logs, media, settings, enquiries, notification_deliveries, notifications, announcements,
    payments, tournament_matches, event_registrations, events, memberships, membership_plans,
    performance_records, attendance_records, attendance_sessions, batch_students, batches, programs,
    booking_events, bookings, coupons, court_blocks, courts, students, coaches, parents, sessions, users
    RESTART IDENTITY CASCADE`);

  /* ── settings ─────────────────────────────────────────────────────────── */
  await db.insert(s.settings).values([
    { key: "booking", value: DEFAULT_BOOKING_SETTINGS },
    { key: "notifications", value: DEFAULT_NOTIFICATION_SETTINGS },
    { key: "attendance", value: DEFAULT_ATTENDANCE_SETTINGS },
    { key: DEMO_MARKER, value: { seededAt: new Date().toISOString() } },
  ]);

  /* ── staff ────────────────────────────────────────────────────────────── */
  const password = await hashPassword("SmashPoint@123");
  const prefs = { emailNotifications: true, smsNotifications: false, whatsappNotifications: true, bookingReminders: true, classReminders: true, marketing: false };

  const [admin, manager, reception] = await db
    .insert(s.users)
    .values([
      { name: "Rohan Deshmukh", email: "admin@smashpoint.in", phone: "+91 98220 41190", passwordHash: password, role: "ADMIN", preferences: prefs },
      { name: "Priya Nair", email: "manager@smashpoint.in", phone: "+91 98225 10442", passwordHash: password, role: "MANAGER", preferences: prefs },
      { name: "Sneha Patil", email: "reception@smashpoint.in", phone: "+91 90040 22871", passwordHash: password, role: "RECEPTION", preferences: prefs },
    ])
    .returning();

  const coachSeed = [
    {
      name: "Vikram Joshi", email: "coach@smashpoint.in", slug: "vikram-joshi", title: "Head Coach", years: 18,
      specialization: "Advanced tactics, singles game-craft & tournament preparation",
      certifications: ["BWF Coach Level 2", "BAI Level 2 Certified Coach", "Sports First Aid (St John Ambulance)"],
      achievements: ["Former national-ranked singles player (Top 40)", "Coached 3 Maharashtra state squad players"],
      bio: "Vikram played national-ranking circuits for eight years before turning to coaching in 2008. He leads SmashPoint's competitive pathway and is known for turning raw athletes into thinking players — expect video breakdowns, match-play scenarios and zero tolerance for lazy footwork.",
    },
    {
      name: "Ananya Kulkarni", email: "ananya@smashpoint.in", slug: "ananya-kulkarni", title: "Senior Coach · Footwork", years: 11,
      specialization: "Singles footwork, court coverage & movement efficiency",
      certifications: ["BAI Level 1 Certified Coach", "SAI Certificate Course in Badminton"],
      achievements: ["Maharashtra State Women's Singles semi-finalist 2014"],
      bio: "Ananya builds the engine behind every shot. Her split-step and six-corner programs are the backbone of our intermediate batches, and her students are famous for never looking rushed.",
    },
    {
      name: "Farhan Shaikh", email: "farhan@smashpoint.in", slug: "farhan-shaikh", title: "Strength & Conditioning Coach", years: 9,
      specialization: "Agility, explosive power & injury prevention",
      certifications: ["NSCA Certified Strength & Conditioning Specialist", "FMS Level 1"],
      achievements: ["S&C consultant, Palghar District Badminton Association"],
      bio: "Farhan designs the conditioning blocks that keep our players fast in the third game. Mobility, landing mechanics and periodised strength work — built specifically for badminton movement.",
    },
    {
      name: "Meera Iyer", email: "meera@smashpoint.in", slug: "meera-iyer", title: "Kids Program Lead", years: 8,
      specialization: "Fundamentals for ages 6–12, coordination & confidence",
      certifications: ["SAI Level 1 Coach", "Positive Coaching Alliance — Youth Sports"],
      achievements: ["Built SmashPoint's kids curriculum used by 90+ children"],
      bio: "Meera turns first-timers into shuttle-obsessed kids. Her sessions mix grip and footwork basics with games that secretly teach racket control — parents say the hardest part is getting the kids to leave.",
    },
    {
      name: "Aditya Rane", email: "aditya@smashpoint.in", slug: "aditya-rane", title: "Intermediate Program Coach", years: 7,
      specialization: "Stroke consistency, net play & deception",
      certifications: ["BAI Level 1 Certified Coach"],
      achievements: ["All-India Inter-University men's doubles quarter-finalist"],
      bio: "Aditya obsesses over clean technique — his multi-shuttle feeding sessions rebuild strokes from the grip up. Great for players stuck on a plateau.",
    },
    {
      name: "Kavya Menon", email: "kavya@smashpoint.in", slug: "kavya-menon", title: "Doubles Specialist", years: 10,
      specialization: "Doubles rotation, front-court interception & serve-receive",
      certifications: ["BAI Level 1 Certified Coach", "Yonex Coach Education Program"],
      achievements: ["Gold, Women's Doubles — MSBA Ranking Tournament 2017"],
      bio: "Kavya's doubles clinics are the most requested sessions at SmashPoint. Attack-defence rotations, flat exchanges and serve patterns that win the first three shots.",
    },
    {
      name: "Sagar Thakur", email: "sagar@smashpoint.in", slug: "sagar-thakur", title: "Assistant Coach · Beginners", years: 5,
      specialization: "Beginner fundamentals & adult learners",
      certifications: ["SAI Certificate Course in Badminton"],
      achievements: ["SmashPoint alumnus — district U-19 champion 2018"],
      bio: "A SmashPoint alumnus, Sagar remembers exactly what it's like to hold a racket for the first time. Patient, structured and brilliant with adult beginners.",
    },
    {
      name: "Neha Gawde", email: "neha@smashpoint.in", slug: "neha-gawde", title: "Assistant Coach · Adult Fitness", years: 6,
      specialization: "Recreational & fitness badminton for adults",
      certifications: ["BAI Level 1 Certified Coach", "ACE Group Fitness Instructor"],
      achievements: ["Runs the Sunday Adult Fitness & Fun community batch"],
      bio: "Neha runs the batches where working professionals and parents fall in love with the sport — sweat, laughs and steadily better rallies.",
    },
  ];

  const coachUsers = await db
    .insert(s.users)
    .values(coachSeed.map((c) => ({ name: c.name, email: c.email, phone: phone(), passwordHash: password, role: "COACH" as const, preferences: prefs })))
    .returning();
  const coaches = await db
    .insert(s.coaches)
    .values(
      coachSeed.map((c, i) => ({
        userId: coachUsers[i]!.id,
        slug: c.slug,
        title: c.title,
        experienceYears: c.years,
        specialization: c.specialization,
        certifications: c.certifications,
        achievements: c.achievements,
        bio: c.bio,
        sortOrder: i,
      })),
    )
    .returning();
  const coachBySlug = Object.fromEntries(coaches.map((c) => [c.slug, c]));

  /* ── courts ───────────────────────────────────────────────────────────── */
  const courts = await db
    .insert(s.courts)
    .values(COURTS)
    .returning();
  const [c1, c2, c3, c4, c5] = courts as [typeof courts[0], typeof courts[0], typeof courts[0], typeof courts[0], typeof courts[0]];

  const maintenanceStart = addDays(TODAY, 2);
  const maintenanceEnd = addDays(TODAY, 4);
  await db.insert(s.courtBlocks).values([
    { courtId: c2.id, type: "MAINTENANCE", startDate: maintenanceStart, endDate: maintenanceEnd, reason: "Floor mat resurfacing", createdById: admin!.id },
    { courtId: c4.id, type: "BLOCKED", startDate: addDays(TODAY, 1), endDate: addDays(TODAY, 1), startMinute: 600, endMinute: 720, reason: "Corporate team session", createdById: manager!.id },
  ]);

  /* ── programs & batches ───────────────────────────────────────────────── */
  const programs = await db
    .insert(s.programs)
    .values(PROGRAMS.map(({ coachSlug, ...p }) => ({ ...p, coachId: coachSlug ? coachBySlug[coachSlug]!.id : null })))
    .returning();
  const prog = Object.fromEntries(programs.map((p) => [p.slug, p]));

  const batchSeed = [
    { name: "Advanced Morning Batch", program: "advanced", coach: "vikram-joshi", court: c1, days: [1, 2, 3, 4, 5, 6], start: 360, end: 480, cap: 12, fee: 3900, level: "ADVANCED" as const },
    { name: "Intermediate Early Birds", program: "intermediate", coach: "kavya-menon", court: c2, days: [1, 2, 3, 4, 5], start: 300, end: 390, cap: 14, fee: 2900, level: "INTERMEDIATE" as const },
    { name: "Beginner Morning Batch", program: "beginner", coach: "sagar-thakur", court: c3, days: [2, 4, 6], start: 420, end: 480, cap: 16, fee: 2200, level: "BEGINNER" as const },
    { name: "Intermediate Evening Batch", program: "intermediate", coach: "aditya-rane", court: c2, days: [1, 3, 5], start: 960, end: 1050, cap: 14, fee: 2900, level: "INTERMEDIATE" as const },
    { name: "Kids Evening Batch", program: "kids", coach: "meera-iyer", court: c4, days: [1, 2, 3, 4, 5], start: 930, end: 990, cap: 10, fee: 1900, level: "KIDS" as const },
    { name: "Kids Weekend Batch", program: "kids", coach: "meera-iyer", court: c3, days: [6, 0], start: 480, end: 600, cap: 10, fee: 1900, level: "KIDS" as const },
    { name: "Competitive Squad (Evening)", program: "advanced", coach: "vikram-joshi", court: c5, days: [2, 4, 6], start: 1020, end: 1140, cap: 10, fee: 3900, level: "ADVANCED" as const },
    { name: "Adult Fitness & Fun", program: "beginner", coach: "neha-gawde", court: c4, days: [6, 0], start: 360, end: 450, cap: 16, fee: 2200, level: "BEGINNER" as const },
  ];
  const batches = await db
    .insert(s.batches)
    .values(
      batchSeed.map((b) => ({
        name: b.name,
        programId: prog[b.program]!.id,
        coachId: coachBySlug[b.coach]!.id,
        courtId: b.court.id,
        daysOfWeek: b.days,
        startMinute: b.start,
        endMinute: b.end,
        capacity: b.cap,
        monthlyFee: rupees(b.fee),
        level: b.level,
        startDate: addDays(TODAY, -300),
      })),
    )
    .returning();

  /* ── membership plans ─────────────────────────────────────────────────── */
  const plans = await db
    .insert(s.membershipPlans)
    .values(MEMBERSHIP_PLANS)
    .returning();
  const planBySlug = Object.fromEntries(plans.map((p) => [p.slug, p]));

  /* ── parents & students ───────────────────────────────────────────────── */
  type StudentDraft = typeof s.students.$inferInsert & { _batch: number; _plan?: string };
  const studentDrafts: StudentDraft[] = [];
  let studentNo = 0;
  const nextCode = () => `SPA-${String(++studentNo).padStart(4, "0")}`;

  // Demo student (has own login)
  const [studentUser] = await db
    .insert(s.users)
    .values({ name: "Ishaan Patil", email: "student@smashpoint.in", phone: "+91 97654 33120", passwordHash: password, role: "STUDENT", preferences: prefs, emergencyContactName: "Sunil Patil", emergencyContactPhone: "+91 98221 76540" })
    .returning();

  // Demo parent with two kids
  const [parentUser] = await db
    .insert(s.users)
    .values({ name: "Rutuja Sawant", email: "parent@smashpoint.in", phone: "+91 98501 22457", passwordHash: password, role: "STUDENT", preferences: prefs })
    .returning();
  const [demoParent] = await db
    .insert(s.parents)
    .values({ userId: parentUser!.id, name: "Rutuja Sawant", relation: "Mother", phone: "+91 98501 22457", email: "parent@smashpoint.in", occupation: "School teacher" })
    .returning();

  const dob = (age: number) => addDays(TODAY, -Math.round(age * 365.25) - int(0, 300));

  studentDrafts.push({
    userId: studentUser!.id, studentCode: nextCode(), name: "Ishaan Patil", dateOfBirth: dob(17), gender: "MALE",
    phone: "+91 97654 33120", email: "student@smashpoint.in", address: "B-402, Shree Residency, Mahim Road, Palghar",
    emergencyContactName: "Sunil Patil", emergencyContactPhone: "+91 98221 76540", joiningDate: addDays(TODAY, -420),
    level: "ADVANCED", qrToken: token(), _batch: 0, _plan: "quarterly",
  });
  studentDrafts.push({
    parentId: demoParent!.id, studentCode: nextCode(), name: "Aarav Sawant", dateOfBirth: dob(10), gender: "MALE",
    address: "12, Gurukrupa Society, Station Road, Palghar", emergencyContactName: "Rutuja Sawant", emergencyContactPhone: "+91 98501 22457",
    joiningDate: addDays(TODAY, -240), level: "BEGINNER", qrToken: token(), _batch: 4, _plan: "half-yearly",
  });
  studentDrafts.push({
    parentId: demoParent!.id, studentCode: nextCode(), name: "Siya Sawant", dateOfBirth: dob(8), gender: "FEMALE",
    address: "12, Gurukrupa Society, Station Road, Palghar", emergencyContactName: "Rutuja Sawant", emergencyContactPhone: "+91 98501 22457",
    joiningDate: addDays(TODAY, -150), level: "BEGINNER", qrToken: token(), _batch: 5, _plan: "quarterly",
  });

  // Everyone else
  const batchPlan = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7];
  const parentRows: (typeof s.parents.$inferInsert)[] = [];
  const extraStudents: StudentDraft[] = [];
  for (const batchIndex of batchPlan) {
    const b = batchSeed[batchIndex]!;
    const kid = b.level === "KIDS";
    const female = chance(0.45);
    const first = female ? pick(FIRST_F) : pick(FIRST_M);
    const last = pick(LAST);
    const age = kid ? int(6, 12) : b.level === "ADVANCED" ? int(12, 22) : b.name.startsWith("Adult") ? int(28, 52) : int(13, 35);
    const minor = age < 18;
    const parentIndex = minor ? parentRows.length : -1;
    if (minor) {
      parentRows.push({ name: `${pick(female ? FIRST_F : FIRST_M) === first ? "Sunita" : pick(["Sunita", "Manisha", "Rajesh", "Sachin", "Vaishali", "Prakash", "Deepali", "Mahesh"])} ${last}`, relation: pick(["Mother", "Father"]), phone: phone(), email: `${last.toLowerCase()}.family${int(10, 99)}@gmail.com` });
    }
    extraStudents.push({
      studentCode: "",
      name: `${first} ${last}`,
      dateOfBirth: dob(age),
      gender: female ? "FEMALE" : "MALE",
      phone: minor ? null : phone(),
      email: minor ? null : `${first.toLowerCase()}.${last.toLowerCase()}${int(1, 99)}@gmail.com`,
      address: `${int(1, 40)}, ${pick(["Sai", "Shiv", "Ganesh", "Laxmi", "Om", "Krishna"])} ${pick(["Apartments", "Society", "Niwas", "Heights"])}, ${pick(AREAS)}, Palghar`,
      emergencyContactName: minor ? "Parent" : `${pick(FIRST_F)} ${last}`,
      emergencyContactPhone: phone(),
      joiningDate: addDays(TODAY, -int(20, 700)),
      level: b.level === "KIDS" ? "BEGINNER" : b.level,
      status: chance(0.93) ? "ACTIVE" : "INACTIVE",
      qrToken: token(),
      _batch: batchIndex,
      parentId: parentIndex >= 0 ? `__parent_${parentIndex}` : undefined,
    });
  }
  const parentsInserted = parentRows.length ? await db.insert(s.parents).values(parentRows).returning() : [];
  for (const st of extraStudents) {
    if (typeof st.parentId === "string" && st.parentId.startsWith("__parent_")) {
      const idx = Number(st.parentId.replace("__parent_", ""));
      st.parentId = parentsInserted[idx]!.id;
      st.emergencyContactName = parentsInserted[idx]!.name;
      st.emergencyContactPhone = parentsInserted[idx]!.phone;
    }
    st.studentCode = nextCode();
    studentDrafts.push(st);
  }

  const studentsInserted = await db
    .insert(s.students)
    .values(studentDrafts.map(({ _batch, _plan, ...st }) => ({ ...st, coachId: coachBySlug[batchSeed[_batch]!.coach]!.id })))
    .returning();
  const studentMeta = studentsInserted.map((st, i) => ({ ...st, batchIndex: studentDrafts[i]!._batch, plan: studentDrafts[i]!._plan }));

  await chunkInsert(
    s.batchStudents,
    studentMeta.map((st) => ({ batchId: batches[st.batchIndex]!.id, studentId: st.id, joinedOn: st.joiningDate, isActive: st.status === "ACTIVE" })),
  );
  // Ishaan also trains with the evening competitive squad.
  await db.insert(s.batchStudents).values({ batchId: batches[6]!.id, studentId: studentMeta[0]!.id, joinedOn: addDays(TODAY, -200) });

  /* ── memberships & payments ───────────────────────────────────────────── */
  const membershipRows: (typeof s.memberships.$inferInsert)[] = [];
  const paymentRows: (typeof s.payments.$inferInsert)[] = [];
  studentMeta.forEach((st, i) => {
    const planSlug = st.plan ?? pick(["monthly", "monthly", "quarterly", "quarterly", "half-yearly", "annual"]);
    const plan = planBySlug[planSlug]!;
    let end: string;
    if (i === 0) end = addDays(TODAY, 31); // "Active — Expires 24 Oct"
    else if (i < 3) end = addDays(TODAY, int(40, 120));
    else {
      const r = rand();
      end = r < 0.12 ? addDays(TODAY, -int(3, 40)) : r < 0.22 ? addDays(TODAY, int(1, 7)) : addDays(TODAY, int(8, plan.durationMonths * 30));
    }
    const start = addMonths(end, -plan.durationMonths);
    const status = st.status === "INACTIVE" && end < TODAY ? "EXPIRED" : end < TODAY ? "EXPIRED" : "ACTIVE";
    membershipRows.push({ studentId: st.id, planId: plan.id, startDate: start, endDate: end, status, paymentStatus: "PAID", price: plan.price });
    // a previous term for longer-tenured students
    if (start > st.joiningDate && chance(0.6)) {
      const prevEnd = addDays(start, -1);
      membershipRows.push({ studentId: st.id, planId: plan.id, startDate: addMonths(prevEnd, -plan.durationMonths), endDate: prevEnd, status: "EXPIRED", paymentStatus: "PAID", price: plan.price });
    }
  });
  const membershipsInserted = await db.insert(s.memberships).values(membershipRows).returning();
  for (const m of membershipsInserted) {
    const st = studentMeta.find((x) => x.id === m.studentId)!;
    const paidAt = at(m.startDate, int(360, 1100));
    if (paidAt > new Date()) continue;
    paymentRows.push({
      receiptNumber: code("RCP", 8),
      purpose: "MEMBERSHIP",
      membershipId: m.id,
      studentId: st.id,
      userId: st.userId ?? (st.parentId === demoParent!.id ? parentUser!.id : null),
      payerName: st.parentId ? `Parent of ${st.name}` : st.name,
      payerEmail: st.email,
      payerPhone: st.phone ?? st.emergencyContactPhone,
      amount: m.price,
      status: "PAID",
      method: pick(["UPI", "UPI", "ONLINE", "CASH", "CARD"] as const),
      provider: "offline",
      paidAt,
      createdAt: paidAt,
      recordedById: reception!.id,
    });
  }

  /* ── bookings ─────────────────────────────────────────────────────────── */
  const guestNames = ["Nikhil Pawar", "Sameer Joshi", "Pooja Vartak", "Akshay Bhoir", "Rahul Mhatre", "Snehal Naik", "Kunal Save", "Amit Shinde", "Prachi Jadhav", "Omkar Kadam", "Swapnil More", "Rashmi Churi", "Tejas Raut", "Hemant Chaudhari", "Varun Thakur", "Mansi Gawde"];
  const guests = guestNames.map((name) => ({ name, phone: phone(), email: `${name.split(" ")[0]!.toLowerCase()}.${name.split(" ")[1]!.toLowerCase()}@gmail.com` }));

  type BookingDraft = typeof s.bookings.$inferInsert;
  const bookingDrafts: BookingDraft[] = [];
  const statusPlan: { i: number; paid: boolean; refunded: boolean }[] = [];

  const settings = DEFAULT_BOOKING_SETTINGS;
  const trainingFor = (courtId: string, date: string) =>
    batchSeed
      .map((b, idx) => ({ b, idx }))
      .filter(({ b }) => b.court.id === courtId && b.days.includes(dayOfWeek(date)))
      .map(({ b }) => ({ start: b.start, end: b.end }));

  const reserved: Record<string, { start: number; end: number }[]> = {};
  const reserve = (courtId: string, date: string, start: number, end: number) => {
    (reserved[`${courtId}:${date}`] ??= []).push({ start, end });
  };

  // Fixed demo bookings for Ishaan: upcoming "Court 2 — Saturday — 5:00 PM" and a couple of past ones.
  let firstSat = addDays(maintenanceEnd, 1);
  while (dayOfWeek(firstSat) !== 6) firstSat = addDays(firstSat, 1);
  const demoBookings = [
    { court: c2, date: firstSat, start: 1020, dur: 60, when: "future" },
    { court: c1, date: addDays(TODAY, -5), start: 1020, dur: 90, when: "past" },
    { court: c5, date: addDays(TODAY, -12), start: 600, dur: 60, when: "past" },
  ];
  const paidAtFor = (date: string) => {
    const t = at(addDays(date, -2), 1200);
    return t > new Date() ? new Date(Date.now() - 26 * 3600_000) : t;
  };
  for (const d of demoBookings) {
    const { price } = priceForRange(d.court, settings.peakWindows, d.date, d.start, d.start + d.dur);
    const discount = Math.round((price * 5) / 100);
    bookingDrafts.push({
      code: code("SP"), courtId: d.court.id, userId: studentUser!.id, customerName: "Ishaan Patil", customerPhone: "+91 97654 33120",
      customerEmail: "student@smashpoint.in", date: d.date, startMinute: d.start, endMinute: d.start + d.dur,
      subtotal: price, discount, total: price - discount, status: "CONFIRMED", source: "ONLINE",
      paidAt: paidAtFor(d.date), confirmedAt: paidAtFor(d.date), createdAt: paidAtFor(d.date),
    });
    statusPlan.push({ i: bookingDrafts.length - 1, paid: true, refunded: false });
    reserve(d.court.id, d.date, d.start, d.start + d.dur);
  }

  for (let offset = -120; offset <= 7; offset++) {
    const date = addDays(TODAY, offset);
    const dow = dayOfWeek(date);
    const weekend = dow === 0 || dow === 6;
    for (const court of courts) {
      if (court.id === c2.id && date >= maintenanceStart && date <= maintenanceEnd) continue;
      const busy = [...trainingFor(court.id, date), ...(reserved[`${court.id}:${date}`] ?? [])];
      if (court.id === c4.id && date === addDays(TODAY, 1)) busy.push({ start: 600, end: 720 });
      let t = settings.openMinute;
      while (t < settings.closeMinute) {
        const dur = pick([60, 60, 60, 90, 30]);
        const end = t + dur;
        const evening = t >= 1020;
        const early = t < 420;
        let p = (weekend ? 0.42 : 0.3) + (evening ? 0.35 : 0) + (early ? 0.12 : 0) - (t >= 660 && t < 900 ? 0.18 : 0);
        if (offset > 0) p *= 0.55 - offset * 0.05;
        if (offset === 0 && t <= NOW_MIN) p *= 1;
        const free = end <= settings.closeMinute && !busy.some((r) => rangesOverlap(t, end, r.start, r.end));
        if (free && chance(p)) {
          const guest = pick(guests);
          const { price } = priceForRange(court, settings.peakWindows, date, t, end);
          const past = offset < 0 || (offset === 0 && end <= NOW_MIN);
          const r = rand();
          const cancelled = past && r < 0.05;
          const refunded = past && r >= 0.05 && r < 0.08;
          const createdAt = at(addDays(date, -int(0, 3)), int(300, 1100));
          const created = createdAt > new Date() ? new Date(Date.now() - int(10, 600) * 60_000) : createdAt;
          bookingDrafts.push({
            code: code("SP"), courtId: court.id, customerName: guest.name, customerPhone: guest.phone, customerEmail: guest.email,
            date, startMinute: t, endMinute: end, subtotal: price, discount: 0, total: price,
            status: cancelled ? "CANCELLED" : refunded ? "REFUNDED" : "CONFIRMED",
            source: chance(0.82) ? "ONLINE" : "WALK_IN",
            paidAt: cancelled ? null : created, confirmedAt: cancelled ? null : created,
            cancelledAt: cancelled || refunded ? created : null,
            cancelReason: cancelled ? "Customer cancelled" : refunded ? "Rain — customer could not travel" : null,
            createdAt: created,
          });
          statusPlan.push({ i: bookingDrafts.length - 1, paid: !cancelled, refunded });
          busy.push({ start: t, end });
          t = end;
        } else {
          t += 30;
        }
      }
    }
  }

  const bookingsInserted: (typeof s.bookings.$inferSelect)[] = [];
  for (let i = 0; i < bookingDrafts.length; i += 400) {
    bookingsInserted.push(...(await db.insert(s.bookings).values(bookingDrafts.slice(i, i + 400)).returning()));
  }

  const bookingEventRows: (typeof s.bookingEvents.$inferInsert)[] = [];
  for (const plan of statusPlan) {
    const b = bookingsInserted[plan.i]!;
    const t0 = b.createdAt;
    const plus = (m: number) => new Date(t0.getTime() + m * 60_000);
    bookingEventRows.push({ bookingId: b.id, status: "PENDING", createdAt: t0 });
    if (plan.paid) {
      bookingEventRows.push({ bookingId: b.id, status: "PAYMENT_INITIATED", createdAt: plus(1) });
      bookingEventRows.push({ bookingId: b.id, status: "PAID", createdAt: plus(2) });
      bookingEventRows.push({ bookingId: b.id, status: "CONFIRMED", createdAt: plus(2) });
      const method = b.source === "WALK_IN" ? pick(["CASH", "UPI"] as const) : "ONLINE";
      paymentRows.push({
        receiptNumber: code("RCP", 8), purpose: "BOOKING", bookingId: b.id, userId: b.userId,
        payerName: b.customerName, payerEmail: b.customerEmail, payerPhone: b.customerPhone, amount: b.total,
        status: plan.refunded ? "REFUNDED" : "PAID", method, provider: method === "ONLINE" ? "mock" : "offline",
        providerOrderId: method === "ONLINE" ? `mock_order_${randomBytes(9).toString("hex")}` : null,
        providerPaymentId: method === "ONLINE" ? `mock_pay_${randomBytes(9).toString("hex")}` : null,
        paidAt: plus(2), createdAt: plus(1),
        refundedAmount: plan.refunded ? b.total : 0, refundedAt: plan.refunded ? plus(600) : null, refundReference: plan.refunded ? `mock_rfnd_${randomBytes(6).toString("hex")}` : null,
      });
      if (plan.refunded) {
        bookingEventRows.push({ bookingId: b.id, status: "CANCELLED", note: b.cancelReason, createdAt: plus(599) });
        bookingEventRows.push({ bookingId: b.id, status: "REFUNDED", createdAt: plus(600) });
      }
    } else {
      bookingEventRows.push({ bookingId: b.id, status: "CANCELLED", note: "Customer cancelled", createdAt: plus(5) });
    }
  }
  await chunkInsert(s.bookingEvents, bookingEventRows, 800);

  /* ── attendance ───────────────────────────────────────────────────────── */
  const enrolments = studentMeta.map((st) => ({ studentId: st.id, batchIndex: st.batchIndex, joined: st.joiningDate, active: st.status === "ACTIVE" }));
  enrolments.push({ studentId: studentMeta[0]!.id, batchIndex: 6, joined: addDays(TODAY, -200), active: true });

  const sessionRows: (typeof s.attendanceSessions.$inferInsert)[] = [];
  const sessionKeys: { batchIndex: number; date: string }[] = [];
  const classNotes = [
    "Worked on split-step timing off the opponent's hit. Good intensity.",
    "Multi-shuttle drills: backhand clears. Several players dropping the elbow — revisit Thursday.",
    "Match-play day. Focus on serve-receive in doubles.",
    "Footwork ladder + six-corner shadow. Stamina looking better across the group.",
    "Net kills and tumbling net shots. Great energy.",
    "Defensive block drills against smashes. Keep racket up!",
  ];
  for (let offset = -45; offset <= 0; offset++) {
    const date = addDays(TODAY, offset);
    batchSeed.forEach((b, idx) => {
      if (!b.days.includes(dayOfWeek(date))) return;
      if (offset === 0 && b.end > NOW_MIN - 60) return; // leave today's later batches for the demo
      if (offset === 0 && idx === 0) return; // and keep the Advanced Morning sheet open for coaches to try
      sessionRows.push({ batchId: batches[idx]!.id, date, notes: chance(0.6) ? pick(classNotes) : null, markedById: coachUsers[coaches.findIndex((c) => c.slug === b.coach)]!.id, createdAt: at(date, b.end) });
      sessionKeys.push({ batchIndex: idx, date });
    });
  }
  const sessionsInserted: (typeof s.attendanceSessions.$inferSelect)[] = [];
  for (let i = 0; i < sessionRows.length; i += 400) {
    sessionsInserted.push(...(await db.insert(s.attendanceSessions).values(sessionRows.slice(i, i + 400)).returning()));
  }
  const recordRows: (typeof s.attendanceRecords.$inferInsert)[] = [];
  sessionsInserted.forEach((sess, i) => {
    const key = sessionKeys[i]!;
    const b = batchSeed[key.batchIndex]!;
    for (const e of enrolments) {
      if (e.batchIndex !== key.batchIndex || !e.active || e.joined > key.date) continue;
      const demo = e.studentId === studentMeta[0]!.id;
      const r = rand();
      const status = demo
        ? r < 0.76 ? "PRESENT" : r < 0.82 ? "LATE" : r < 0.94 ? "ABSENT" : "LEAVE"
        : r < 0.8 ? "PRESENT" : r < 0.87 ? "LATE" : r < 0.95 ? "ABSENT" : "LEAVE";
      recordRows.push({
        sessionId: sess.id, studentId: e.studentId, status, source: chance(0.35) && status !== "ABSENT" && status !== "LEAVE" ? "QR" : "MANUAL",
        markedAt: at(key.date, b.start + (status === "LATE" ? int(11, 20) : int(-5, 5))), markedById: sess.markedById,
      });
    }
  });
  await chunkInsert(s.attendanceRecords, recordRows, 800);

  /* ── performance ──────────────────────────────────────────────────────── */
  const perfRows: (typeof s.performanceRecords.$inferInsert)[] = [];
  const perfNotes = [
    "Footwork recovery to base is faster. Next: deception on the forehand drop.",
    "Smash power improving, but steepness drops when tired — more S&C.",
    "Serve is consistent; work on flick serve disguise in doubles.",
    "Defence is the standout. Needs to counter-attack instead of just lifting.",
    "Great attitude in match play. Shot selection under pressure still rushed.",
  ];
  for (const st of studentMeta) {
    const b = batchSeed[st.batchIndex]!;
    if (b.level === "BEGINNER" && !chance(0.4)) continue;
    const base = b.level === "ADVANCED" ? 6 : b.level === "INTERMEDIATE" ? 4.5 : 3;
    const coachId = coachBySlug[b.coach]!.id;
    for (let k = 4; k >= 1; k--) {
      const assessedOn = addDays(TODAY, -k * 28 - int(0, 3));
      if (assessedOn < st.joiningDate) continue;
      const growth = (4 - k) * 0.45;
      const score = (bias = 0) => Math.max(1, Math.min(10, Math.round(base + growth + bias + (rand() - 0.5) * 1.6)));
      perfRows.push({
        studentId: st.id, coachId, assessedOn,
        footwork: score(0.3), smash: score(0.2), drop: score(-0.2), serve: score(0.5), defense: score(0), agility: score(0.2), stamina: score(-0.3), matchPerformance: score(-0.4),
        notes: k === 1 || chance(0.4) ? pick(perfNotes) : null,
        createdAt: at(assessedOn, 1140),
      });
    }
  }
  await chunkInsert(s.performanceRecords, perfRows);

  /* ── events ───────────────────────────────────────────────────────────── */
  const eventsInserted = await db
    .insert(s.events)
    .values([
      {
        slug: "free-trial-weekend", name: "Free Trial Weekend", category: "TRIAL", status: "PUBLISHED",
        summary: "Two days of free coaching sessions for new players of every age.",
        description: "Never trained formally? Bring your family and try a full 60-minute session with our coaches on any court, free. Rackets and shuttles provided.\n\nKids sessions run 8–10 AM, adult sessions 10 AM–12 PM on both days. Register below so we can plan coaches and courts.",
        date: addDays(TODAY, 4), endDate: addDays(TODAY, 5), startMinute: 480, endMinute: 720, fee: 0, registrationLimit: 60,
        registrationDeadline: addDays(TODAY, 3), divisions: ["Kids (6–12)", "Teens (13–17)", "Adults (18+)"], createdById: manager!.id,
      },
      {
        slug: "footwork-masterclass-vikram-joshi", name: "Footwork Masterclass with Vikram Joshi", category: "WORKSHOP", status: "PUBLISHED",
        summary: "A 3-hour intensive on split-step, recovery and six-corner movement.",
        description: "Our Head Coach breaks down the movement patterns that separate club players from tournament players: split-step timing, lunging mechanics, rear-court recovery and deceptive first steps.\n\nIncludes video capture of your movement and a personalised drill plan to take home. Limited to 30 players.",
        date: addDays(TODAY, 11), startMinute: 420, endMinute: 600, fee: rupees(800), registrationLimit: 30, registrationDeadline: addDays(TODAY, 9),
        divisions: ["Intermediate", "Advanced"], createdById: admin!.id,
      },
      {
        slug: "smashpoint-monsoon-open-2026", name: "SmashPoint Monsoon Open 2026", category: "TOURNAMENT", status: "PUBLISHED",
        summary: "Our flagship open tournament — 7 categories, cash prizes and ranking points.",
        description: "The biggest badminton weekend in Palghar is back. Knockout format across junior and open categories, played on all five courts with certified line umpires for semi-finals and finals.\n\nPrize pool of ₹60,000, trophies for winners and runners-up, and medals for semi-finalists. Yonex Mavis 350 shuttles for junior categories, feather shuttles for open categories.",
        date: addDays(TODAY, 17), endDate: addDays(TODAY, 18), startMinute: 420, endMinute: 1140, fee: rupees(600), registrationLimit: 128,
        registrationDeadline: addDays(TODAY, 12), format: "KNOCKOUT",
        divisions: ["U-13 Boys Singles", "U-13 Girls Singles", "U-17 Boys Singles", "U-17 Girls Singles", "Men's Singles", "Women's Singles", "Open Doubles"],
        createdById: admin!.id,
      },
      {
        slug: "parents-and-kids-doubles-day", name: "Parents & Kids Doubles Day", category: "SOCIAL", status: "PUBLISHED",
        summary: "A fun doubles morning — every kid partners with a parent.",
        description: "Parents, it's your turn on court! Pair up with your child for a relaxed round-robin doubles morning. No experience needed. Breakfast, medals for everyone and a surprise trophy for the loudest cheering squad.",
        date: addDays(TODAY, 25), startMinute: 480, endMinute: 660, fee: rupees(300), registrationLimit: 40, registrationDeadline: addDays(TODAY, 22),
        divisions: ["Parent + Kid"], createdById: manager!.id,
      },
      {
        slug: "diwali-junior-camp-2026", name: "Diwali Break Junior Camp", category: "CAMP", status: "PUBLISHED",
        summary: "7-day intensive camp for juniors during the Diwali school break.",
        description: "Two sessions a day for seven days: technical blocks in the morning, match-play and conditioning in the evening. Includes a camp tee, daily snacks and a final-day tournament.\n\nOpen to non-members with at least 6 months of playing experience.",
        date: addDays(TODAY, 40), endDate: addDays(TODAY, 46), startMinute: 360, endMinute: 1080, fee: rupees(4500), registrationLimit: 40, registrationDeadline: addDays(TODAY, 35),
        divisions: ["U-11", "U-13", "U-15"], createdById: admin!.id,
      },
      {
        slug: "summer-smash-junior-league-2026", name: "Summer Smash Junior League", category: "TOURNAMENT", status: "COMPLETED",
        summary: "Six-week junior team league — congratulations Team Falcons!",
        description: "Our summer team league for juniors wrapped up with Team Falcons lifting the trophy after a thrilling 3–2 final against Team Cheetahs.",
        date: addDays(TODAY, -80), endDate: addDays(TODAY, -38), startMinute: 480, endMinute: 720, fee: rupees(500), registrationLimit: 48,
        divisions: ["Junior Team League"], format: "ROUND_ROBIN", createdById: admin!.id,
      },
    ])
    .returning();

  const regRows: (typeof s.eventRegistrations.$inferInsert)[] = [];
  eventsInserted.forEach((ev, idx) => {
    const n = [34, 17, 58, 12, 9, 44][idx]!;
    for (let k = 0; k < n; k++) {
      const female = chance(0.45);
      const name = `${female ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`;
      regRows.push({
        eventId: ev.id, participantName: name,
        email: `${name.replace(" ", ".").toLowerCase()}${k}@gmail.com`, phone: phone(), division: pick(ev.divisions),
        status: "CONFIRMED", paymentStatus: ev.fee > 0 ? "PAID" : "CREATED", amount: ev.fee,
        createdAt: new Date(Date.now() - int(1, 20) * 86_400_000),
      });
    }
  });
  // The demo student is registered for the Monsoon Open.
  regRows.push({ eventId: eventsInserted[2]!.id, userId: studentUser!.id, studentId: studentMeta[0]!.id, participantName: "Ishaan Patil", email: "student@smashpoint.in", phone: "+91 97654 33120", division: "U-17 Boys Singles", status: "CONFIRMED", paymentStatus: "PAID", amount: rupees(600) });
  const regsInserted = await db.insert(s.eventRegistrations).values(regRows).returning();
  for (const r of regsInserted) {
    if (r.amount <= 0) continue;
    paymentRows.push({
      receiptNumber: code("RCP", 8), purpose: "EVENT", eventRegistrationId: r.id, userId: r.userId, studentId: r.studentId,
      payerName: r.participantName, payerEmail: r.email, payerPhone: r.phone, amount: r.amount, status: "PAID", method: "ONLINE",
      provider: "mock", providerOrderId: `mock_order_${randomBytes(9).toString("hex")}`, providerPaymentId: `mock_pay_${randomBytes(9).toString("hex")}`,
      paidAt: r.createdAt, createdAt: r.createdAt,
    });
  }

  await chunkInsert(s.payments, paymentRows);

  /* ── coupons, announcements, notifications, enquiries ─────────────────── */
  await db.insert(s.coupons).values([
    { code: "WELCOME10", description: "10% off your first court booking", type: "PERCENT", value: 10, scope: "BOOKING", maxDiscount: rupees(100), maxUses: 500, usedCount: 87 },
    { code: "SMASH50", description: "₹50 off bookings of ₹400+", type: "FLAT", value: rupees(50), scope: "BOOKING", minAmount: rupees(400), usedCount: 23 },
    { code: "MONSOON20", description: "20% off memberships this monsoon", type: "PERCENT", value: 20, scope: "MEMBERSHIP", maxDiscount: rupees(3000), validUntil: addDays(TODAY, 30), usedCount: 11 },
  ]);

  await db.insert(s.announcements).values([
    {
      title: "Academy closed on 2 October", body: "The academy will be closed on Friday, 2 October (Gandhi Jayanti) for scheduled electrical maintenance. All batches resume on 3 October. Court bookings for that day are disabled.",
      audience: "EVERYONE", isPinned: true, showOnWebsite: true, publishedAt: new Date(Date.now() - 2 * 3600_000), createdById: admin!.id,
    },
    {
      title: "Court 2 floor resurfacing", body: `Court 2 will be under maintenance from ${maintenanceStart} to ${maintenanceEnd} while we replace the PU mat. Batches normally on Court 2 move to Court 5 during this window.`,
      audience: "EVERYONE", showOnWebsite: true, publishedAt: new Date(Date.now() - 26 * 3600_000), createdById: manager!.id,
    },
    {
      title: "Monsoon Open registrations are live", body: "Registrations for the SmashPoint Monsoon Open 2026 are open! Members get priority seeding. Register from the Events page before the deadline.",
      audience: "EVERYONE", showOnWebsite: false, publishedAt: new Date(Date.now() - 4 * 86_400_000), createdById: admin!.id,
    },
    {
      title: "Coaches' meeting — Saturday 8 PM", body: "Monthly coaches' sync on Saturday after the evening squad. Agenda: October assessment calendar and Monsoon Open duty roster.",
      audience: "STAFF", showOnWebsite: false, publishedAt: new Date(Date.now() - 20 * 3600_000), createdById: admin!.id,
    },
  ]);

  const note = (userId: string, type: typeof s.notificationType.enumValues[number], title: string, body: string, hoursAgo: number, read = false, link: string | null = null) => ({
    userId, type, title, body, link, createdAt: new Date(Date.now() - hoursAgo * 3600_000), readAt: read ? new Date() : null,
  });
  const demoFirst = bookingsInserted[0]!;
  await db.insert(s.notifications).values([
    note(studentUser!.id, "ANNOUNCEMENT", "Academy closed on 2 October", "The academy will be closed on Friday, 2 October for scheduled electrical maintenance.", 2),
    note(studentUser!.id, "BOOKING_CONFIRMED", `Booking confirmed · ${demoFirst.code}`, "Court 2 on Saturday, 5:00 – 6:00 PM. See you on court!", 30, false, "/dashboard/bookings"),
    note(studentUser!.id, "CLASS_REMINDER", "Advanced Morning Batch tomorrow", "6:00 – 8:00 AM on Court 1 with Vikram Joshi. Bring a spare grip.", 8, true),
    note(studentUser!.id, "EVENT", "You're registered · SmashPoint Monsoon Open 2026", "U-17 Boys Singles. Draws will be published 3 days before the event.", 72, true, "/events/smashpoint-monsoon-open-2026"),
    note(studentUser!.id, "PAYMENT_RECEIVED", "Payment received", "₹6,900 received for your Quarterly membership.", 24 * 60, true, "/dashboard/membership"),
    note(parentUser!.id, "ANNOUNCEMENT", "Academy closed on 2 October", "The academy will be closed on Friday, 2 October for scheduled electrical maintenance.", 2),
    note(parentUser!.id, "CLASS_REMINDER", "Kids Weekend Batch on Saturday", "Siya's batch runs 8:00 – 10:00 AM on Court 3.", 5),
    note(admin!.id, "GENERAL", "3 memberships expire this week", "Send renewal reminders from Memberships → Expiring soon.", 4, false, "/dashboard/memberships?filter=expiring"),
    note(admin!.id, "PAYMENT_RECEIVED", "New online booking", "₹600 received for Court 1 · today 5:00 PM.", 1, false, "/dashboard/bookings"),
  ]);

  await db.insert(s.enquiries).values([
    { name: "Kiran Vartak", email: "kiran.vartak@gmail.com", phone: "+91 98191 22331", subject: "Kids Program", message: "Hi, my son is 7. Is there space in the weekend kids batch? We are free only on Saturdays.", createdAt: new Date(Date.now() - 3 * 3600_000) },
    { name: "Ajinkya Bhoir", email: "ajinkya.b@outlook.com", subject: "Corporate booking", message: "We'd like to book 3 courts every Friday 5–7 PM for our office team (18 people). Do you offer monthly corporate packages?", createdAt: new Date(Date.now() - 27 * 3600_000), status: "IN_PROGRESS" },
    { name: "Shruti Naik", email: "shruti.naik@gmail.com", phone: "+91 90290 44112", subject: "Coaching", message: "I played at school level 10 years ago. Which program should I join to get back into shape?", createdAt: new Date(Date.now() - 50 * 3600_000) },
  ]);

  console.log(`✅ Seeded ${studentsInserted.length} students, ${bookingsInserted.length} bookings, ${paymentRows.length} payments, ${recordRows.length} attendance records.`);
  console.log(`
Demo accounts (password: SmashPoint@123)
  Admin      admin@smashpoint.in
  Manager    manager@smashpoint.in
  Reception  reception@smashpoint.in
  Coach      coach@smashpoint.in
  Student    student@smashpoint.in
  Parent     parent@smashpoint.in`);
}

