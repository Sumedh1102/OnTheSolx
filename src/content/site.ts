/**
 * Public website content. Everything marketing-related lives here so it can be replaced
 * without touching components. Operational data (courts, coaches, programs, membership
 * plans, events, announcements) lives in the database and is managed from the dashboard.
 */

export const site = {
  name: "SmashPoint Badminton Academy",
  shortName: "SmashPoint",
  tagline: "Train sharper. Play faster. Book in seconds.",
  description:
    "SmashPoint is Palghar's premier badminton academy — 5 pro-grade courts, certified coaches and structured programs for kids, beginners and competitive players. Book a court online in under a minute.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  founded: 2016,
  contact: {
    phone: "+91 98220 41190",
    phoneHref: "tel:+919822041190",
    whatsapp: "+91 98220 41190",
    whatsappHref: "https://wa.me/919822041190?text=Hi%20SmashPoint%2C%20I%27d%20like%20to%20know%20more",
    email: "hello@smashpoint.in",
    addressLines: ["Plot 14, Mahim Road", "Near Hutatma Stambh", "Palghar, Maharashtra 401404"],
    mapQuery: "Mahim Road, Palghar, Maharashtra 401404",
    openingHours: [
      { days: "Monday – Saturday", hours: "4:00 AM – 7:00 PM" },
      { days: "Sunday", hours: "4:00 AM – 7:00 PM" },
      { days: "Front desk", hours: "6:00 AM – 7:00 PM" },
    ],
  },
  socials: [
    { label: "Instagram", href: "https://instagram.com/smashpoint.academy", handle: "@smashpoint.academy" },
    { label: "YouTube", href: "https://youtube.com/@smashpointacademy", handle: "SmashPoint TV" },
    { label: "Facebook", href: "https://facebook.com/smashpointacademy", handle: "SmashPoint Academy" },
    { label: "WhatsApp", href: "https://wa.me/919822041190", handle: "+91 98220 41190" },
  ],
  stats: [
    { value: "5", label: "Pro-grade courts", note: "BWF-spec PU mats" },
    { value: "200+", label: "Active students", note: "Ages 6 to 60" },
    { value: "10+", label: "Certified coaches", note: "BAI & SAI certified" },
    { value: "15K+", label: "Sessions completed", note: "Since 2016" },
  ],
} as const;

export const about = {
  story: [
    "SmashPoint started in 2016 with a single rented court, twelve kids and one very loud whistle. Our founder, Rohan Deshmukh, a former state-level doubles player, wanted Palghar's players to stop commuting two hours to Mumbai for serious coaching.",
    "Ten years later we run five professional courts, a strength & conditioning corner and a coaching team that has sent players to district, state and national-ranking tournaments — while keeping the same neighbourhood feel that made those first twelve kids stay.",
  ],
  mission:
    "Make world-class badminton training accessible in Palghar — structured coaching, honest feedback and courts that are as easy to book as a cab.",
  vision:
    "Become Maharashtra's most trusted grassroots-to-podium badminton pathway, producing players who are as disciplined off court as they are sharp on it.",
  philosophy: [
    {
      title: "Footwork first",
      body: "Every great shot starts two steps earlier. Movement drills open every session, at every level.",
    },
    {
      title: "Measure everything",
      body: "Skills are scored monthly across 8 areas, so students and parents see progress — not guesses.",
    },
    {
      title: "Small groups",
      body: "Max 12 players per coach in advanced batches, 10 in kids batches. Nobody hides at the back.",
    },
    {
      title: "Play with joy",
      body: "Discipline and fun aren't opposites. Match days, ladders and team challenges keep training alive.",
    },
  ],
  achievements: [
    { year: "2026", title: "3 players selected for Maharashtra U-15 state squad" },
    { year: "2025", title: "Overall champions — Palghar District Junior Championship" },
    { year: "2025", title: "Gold, Men's Doubles — MSBA Ranking Tournament, Nashik" },
    { year: "2024", title: "Silver, U-13 Girls Singles — Maharashtra State Mini Championship" },
    { year: "2023", title: "Opened courts 4 & 5 with LED glare-free lighting" },
    { year: "2019", title: "First SmashPoint player in national junior rankings (Top 64)" },
  ],
  gallery: [
    { title: "Court 3 · Evening squad", variant: "court" },
    { title: "Kids batch · Shuttle relay", variant: "shuttle" },
    { title: "Monsoon Open 2025 finals", variant: "trophy" },
    { title: "Footwork ladder drills", variant: "grid" },
    { title: "Strength & conditioning corner", variant: "racket" },
    { title: "Parents' viewing gallery", variant: "court" },
  ],
} as const;

export const facilities = [
  {
    icon: "courts",
    title: "5 Badminton Courts",
    spec: "BWF-spec dimensions",
    body: "Five full-size courts with 9 m clear ceiling height, regulation nets and posts, and 2 m run-off on every side.",
  },
  {
    icon: "lighting",
    title: "Glare-free Lighting",
    spec: "LED · 800+ lux",
    body: "Side-mounted LED panels that never sit above the shuttle's flight path — no blinding smashes, even at 5 AM.",
  },
  {
    icon: "flooring",
    title: "Pro Flooring",
    spec: "4.5 mm PU on wooden sub-floor",
    body: "Cushioned synthetic mats over sprung wood reduce knee and ankle load while keeping grip consistent.",
  },
  {
    icon: "seating",
    title: "Spectator Seating",
    spec: "60-seat gallery",
    body: "Raised seating for parents and match days, with a clear view of all five courts.",
  },
  {
    icon: "changing",
    title: "Changing Rooms",
    spec: "Separate · with lockers",
    body: "Clean men's and women's changing rooms with showers and 80 day-use lockers.",
  },
  {
    icon: "water",
    title: "Drinking Water",
    spec: "RO filtered · chilled",
    body: "Two chilled RO water stations on the floor. Bring a bottle — we're a no-single-use-plastic academy.",
  },
  {
    icon: "parking",
    title: "Parking",
    spec: "30 cars · 60 two-wheelers",
    body: "Free, gated parking with CCTV. Drop-off lane for kids' batches at peak times.",
  },
  {
    icon: "equipment",
    title: "Training Equipment",
    spec: "Shuttle machine · agility kit",
    body: "Feather shuttle launcher, agility ladders, resistance bands and a strength corner for conditioning blocks.",
  },
] as const;

export const whyChooseUs = [
  {
    title: "Book in under a minute",
    body: "Live court availability, instant confirmation and digital receipts. No calls, no WhatsApp back-and-forth.",
  },
  {
    title: "Certified, specialist coaches",
    body: "BAI & SAI certified coaches, each owning a specialty — footwork, doubles, kids or conditioning.",
  },
  {
    title: "Progress you can see",
    body: "Attendance, skill scores and coach notes in the student dashboard. Parents always know how it's going.",
  },
  {
    title: "Competition pathway",
    body: "Internal ladders, monthly match days and guided entry into district, state and ranking tournaments.",
  },
] as const;

export const testimonials = [
  {
    quote:
      "My daughter joined the kids batch too shy to call for the shuttle. Eight months later she's the loudest voice on court 4 and just won her first district medal.",
    name: "Rutuja Sawant",
    role: "Parent · Kids Program",
  },
  {
    quote:
      "I book the 5 AM slot three times a week before work. The booking takes 20 seconds and the court is always ready — lights on, net set.",
    name: "Nikhil Pawar",
    role: "Court regular · Software engineer",
  },
  {
    quote:
      "Vikram sir fixed my backhand clear in three sessions after two years of bad habits. The monthly skill report is brutally honest, which is exactly what I needed.",
    name: "Ishaan Patil",
    role: "Advanced Program · U-19",
  },
  {
    quote:
      "Best-maintained courts between Virar and Dahanu. The flooring is kind to my knees and the lighting doesn't blind you on high clears.",
    name: "Dr. Sameer Joshi",
    role: "Adult Fitness batch",
  },
  {
    quote:
      "The attendance and fee reminders on WhatsApp mean I never have to chase anything. Everything is in the app.",
    name: "Manoj Chaudhari",
    role: "Parent · Intermediate Program",
  },
  {
    quote: "Came for a free trial weekend, stayed for the coaching. The doubles rotation drills are next level.",
    name: "Tanvi Raut",
    role: "Intermediate Program",
  },
] as const;

export const faqs = [
  {
    q: "Do I need to be a member to book a court?",
    a: "No. Anyone can book a court online with just a name, phone number and email. Members get 5–15% off court bookings depending on their plan.",
  },
  {
    q: "What are the court timings?",
    a: "Courts are open every day from 4:00 AM to 7:00 PM. You can book 30, 60 or 90-minute slots up to 14 days in advance.",
  },
  {
    q: "What is peak and non-peak pricing?",
    a: "Non-peak (4 AM – 5 PM) is ₹400/hour and peak (5 PM – 7 PM) is ₹600/hour on standard courts. The price is always shown before you pay.",
  },
  {
    q: "Can I cancel or reschedule a booking?",
    a: "You can cancel from your dashboard up to 6 hours before the slot for a full refund. For reschedules, call or WhatsApp the front desk and we'll move it for you.",
  },
  {
    q: "What age can kids start?",
    a: "Our Kids Program starts at age 6. We focus on coordination, fun movement games and basic grips before technical training.",
  },
  {
    q: "Do you provide rackets and shuttles?",
    a: "Rackets are available on rent at the front desk (₹50/session). Coaching batches include shuttles. For court bookings, bring your own or buy a tube at the desk.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every new student gets one free trial session in their chosen program. We also run Free Trial Weekends every quarter.",
  },
  {
    q: "How do parents track progress?",
    a: "Parents get their own login with attendance, membership status, payment history and monthly skill scores from the coach.",
  },
] as const;

export type SiteContent = typeof site;
