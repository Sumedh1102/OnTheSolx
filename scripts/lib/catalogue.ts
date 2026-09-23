/**
 * The academy's real catalogue (courts, programs, membership plans). Shared by the demo seed
 * and the production first-run setup so a fresh deployment has a working public site.
 * Edit prices and descriptions here, or later from the admin dashboard.
 */
import type { courts, membershipPlans, programs } from "../../src/server/db/schema";

const rupees = (n: number) => n * 100;

export const COURTS: (typeof courts.$inferInsert)[] = [
  { name: "Court 1", description: "Main competition court beside the viewing gallery.", hourlyRate: rupees(400), peakHourlyRate: rupees(600), sortOrder: 1 },
  { name: "Court 2", description: "Training court with shuttle-launcher mount.", hourlyRate: rupees(400), peakHourlyRate: rupees(600), sortOrder: 2 },
  { name: "Court 3", description: "Standard court, near changing rooms.", hourlyRate: rupees(400), peakHourlyRate: rupees(600), sortOrder: 3 },
  { name: "Court 4", description: "Standard court with kids' low-net setup available.", hourlyRate: rupees(400), peakHourlyRate: rupees(600), sortOrder: 4 },
  { name: "Court 5", description: "Show court · premium lighting & 4.5 mm mat.", surface: "Premium 4.5 mm PU mat", hourlyRate: rupees(500), peakHourlyRate: rupees(700), sortOrder: 5 },
];

/** `coachSlug` links a program to its lead coach when coaches exist (demo data). */
export const PROGRAMS: (Omit<typeof programs.$inferInsert, "coachId"> & { coachSlug?: string })[] = [
  {
    slug: "beginner", name: "Beginner Program", level: "BEGINNER", sortOrder: 1,
    tagline: "From first grip to first real rally.",
    description: "For students learning badminton fundamentals: grips, ready position, basic footwork, the four core strokes and the rules of the game. Small groups, lots of repetition and a coach who celebrates every clean clear.",
    ageGroup: "13+ years & adults", frequency: "3 sessions / week", sessionDuration: "60 min", programLength: "12 weeks",
    coachSlug: "sagar-thakur", monthlyFee: rupees(2200),
    highlights: ["Grip & stance fundamentals", "Six-corner footwork basics", "Clear, drop, smash & serve", "Monthly skill assessment"],
  },
  {
    slug: "intermediate", name: "Intermediate Program", level: "INTERMEDIATE", sortOrder: 2,
    tagline: "Consistency, movement and smarter shot selection.",
    description: "For players developing consistency, movement and technique. Multi-shuttle feeding, structured footwork patterns, net play and introduction to singles & doubles tactics with regular match-play.",
    ageGroup: "12+ years", frequency: "4 sessions / week", sessionDuration: "90 min", programLength: "16 weeks",
    coachSlug: "aditya-rane", monthlyFee: rupees(2900),
    highlights: ["Multi-shuttle technique blocks", "Split-step & recovery patterns", "Doubles rotation basics", "Fortnightly match-play"],
  },
  {
    slug: "advanced", name: "Advanced Program", level: "ADVANCED", sortOrder: 3,
    tagline: "Competitive training for tournament players.",
    description: "For competitive players targeting district, state and ranking tournaments. High-intensity sessions with tactical video review, periodised S&C, match simulation and individual tournament planning.",
    ageGroup: "11–25 years (by selection)", frequency: "6 sessions / week", sessionDuration: "120 min", programLength: "Season-long",
    coachSlug: "vikram-joshi", monthlyFee: rupees(3900),
    highlights: ["Tactical video analysis", "Periodised strength & conditioning", "Tournament calendar planning", "1-on-1 monthly review"],
  },
  {
    slug: "kids", name: "Kids Program", level: "KIDS", sortOrder: 4,
    tagline: "Structured, joyful training for young players.",
    description: "Structured training for younger players. Coordination games, racket skills and movement fundamentals taught through play — building confidence, discipline and a love for the sport.",
    ageGroup: "6–12 years", frequency: "3 or 5 sessions / week", sessionDuration: "60 min", programLength: "Term-based (12 weeks)",
    coachSlug: "meera-iyer", monthlyFee: rupees(1900),
    highlights: ["Max 10 kids per coach", "Coordination & agility games", "Parent progress updates", "Term-end mini tournament"],
  },
];

export const MEMBERSHIP_PLANS: (typeof membershipPlans.$inferInsert)[] = [
  {
    name: "Monthly", slug: "monthly", durationMonths: 1, price: rupees(2500), sortOrder: 1, courtDiscountPercent: 0,
    description: "Try the academy with full batch access, no long commitment.",
    trainingAccess: "1 batch · up to 3 sessions/week",
    benefits: ["Coaching in your assigned batch", "Monthly skill assessment", "Student dashboard & QR check-in", "Member rates on events"],
  },
  {
    name: "Quarterly", slug: "quarterly", durationMonths: 3, price: rupees(6900), sortOrder: 2, courtDiscountPercent: 5,
    description: "Our most popular plan for steady improvement.",
    trainingAccess: "1 batch · up to 4 sessions/week",
    benefits: ["Everything in Monthly", "5% off court bookings", "Free racket restring (1×)", "Priority batch transfers"],
    isFeatured: true,
  },
  {
    name: "Half-Yearly", slug: "half-yearly", durationMonths: 6, price: rupees(12900), sortOrder: 3, courtDiscountPercent: 10,
    description: "Serious training with room to switch batches.",
    trainingAccess: "Up to 2 batches · 5 sessions/week",
    benefits: ["Everything in Quarterly", "10% off court bookings", "Quarterly 1-on-1 coach review", "SmashPoint training tee"],
  },
  {
    name: "Annual", slug: "annual", durationMonths: 12, price: rupees(23900), sortOrder: 4, courtDiscountPercent: 15,
    description: "Best value for committed players and families.",
    trainingAccess: "Unlimited batches at your level",
    benefits: ["Everything in Half-Yearly", "15% off court bookings", "Free entry to 2 academy tournaments", "Video analysis session every quarter"],
  },
];
