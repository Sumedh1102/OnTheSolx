import { describe, expect, it } from "vitest";
import { applyDiscount, computeAvailability, priceForRange, slotTimes } from "./engine";

const peakWindows = [{ label: "Evening", startMinute: 17 * 60, endMinute: 19 * 60, days: [] }];
const court = { id: "c1", name: "Court 1", status: "ACTIVE" as const, hourlyRate: 40000, peakHourlyRate: 60000 };

describe("slotTimes", () => {
  it("generates hourly slots between 4 AM and 7 PM", () => {
    const times = slotTimes(240, 1140, 60);
    expect(times).toHaveLength(15);
    expect(times[0]).toEqual({ startMinute: 240, endMinute: 300 });
    expect(times.at(-1)).toEqual({ startMinute: 1080, endMinute: 1140 });
  });

  it("never produces a slot that runs past closing", () => {
    const times = slotTimes(240, 1140, 90);
    expect(times.every((t) => t.endMinute <= 1140)).toBe(true);
    expect(times).toHaveLength(10);
  });
});

describe("priceForRange", () => {
  it("charges non-peak rate before 5 PM", () => {
    expect(priceForRange(court, peakWindows, "2026-09-24", 600, 660)).toEqual({ price: 40000, isPeak: false });
  });

  it("charges peak rate inside the peak window", () => {
    expect(priceForRange(court, peakWindows, "2026-09-24", 1020, 1080)).toEqual({ price: 60000, isPeak: true });
  });

  it("blends rates for slots straddling the window", () => {
    // 16:30–17:30 → 30 min @ 400/hr + 30 min @ 600/hr = 500
    expect(priceForRange(court, peakWindows, "2026-09-24", 990, 1050).price).toBe(50000);
  });

  it("respects weekday-specific windows", () => {
    const weekendOnly = [{ label: "Weekend", startMinute: 240, endMinute: 1140, days: [0, 6] }];
    expect(priceForRange(court, weekendOnly, "2026-09-26", 600, 660).isPeak).toBe(true); // Saturday
    expect(priceForRange(court, weekendOnly, "2026-09-24", 600, 660).isPeak).toBe(false); // Thursday
  });
});

describe("computeAvailability", () => {
  const base = {
    date: "2026-09-24",
    duration: 60,
    settings: { openMinute: 240, closeMinute: 1140, peakWindows },
    courts: [court, { ...court, id: "c2", name: "Court 2" }],
    bookings: [],
    blocks: [],
    training: [],
    nowMinute: null,
  };

  it("marks overlapping bookings as BOOKED, including partial overlaps", () => {
    const result = computeAvailability({ ...base, bookings: [{ courtId: "c1", startMinute: 330, endMinute: 390 }] });
    const c1 = result.courts[0]!.slots;
    expect(c1.find((s) => s.startMinute === 300)!.state).toBe("BOOKED");
    expect(c1.find((s) => s.startMinute === 360)!.state).toBe("BOOKED");
    expect(c1.find((s) => s.startMinute === 420)!.state).toBe("AVAILABLE");
    expect(result.courts[1]!.slots.every((s) => s.state === "AVAILABLE")).toBe(true);
  });

  it("blocks the whole day for maintenance", () => {
    const result = computeAvailability({
      ...base,
      blocks: [{ courtId: "c2", type: "MAINTENANCE", startMinute: null, endMinute: null, reason: "Floor resurfacing" }],
    });
    expect(result.courts[1]!.slots.every((s) => s.state === "MAINTENANCE")).toBe(true);
    expect(result.courts[1]!.availableCount).toBe(0);
  });

  it("marks court in maintenance mode and hides inactive courts", () => {
    const result = computeAvailability({
      ...base,
      courts: [{ ...court, status: "MAINTENANCE" }, { ...court, id: "c3", status: "INACTIVE" }],
    });
    expect(result.courts).toHaveLength(1);
    expect(result.courts[0]!.slots[0]!.state).toBe("MAINTENANCE");
  });

  it("marks elapsed slots as PAST for today", () => {
    const result = computeAvailability({ ...base, nowMinute: 600 });
    const slots = result.courts[0]!.slots;
    expect(slots.find((s) => s.startMinute === 600)!.state).toBe("PAST");
    expect(slots.find((s) => s.startMinute === 660)!.state).toBe("AVAILABLE");
  });

  it("reserves courts for training batches", () => {
    const result = computeAvailability({
      ...base,
      training: [{ courtId: "c1", startMinute: 360, endMinute: 480, label: "Advanced Morning" }],
    });
    const slot = result.courts[0]!.slots.find((s) => s.startMinute === 420)!;
    expect(slot.state).toBe("TRAINING");
    expect(slot.label).toBe("Advanced Morning");
  });
});

describe("applyDiscount", () => {
  it("applies capped percentage discounts", () => {
    expect(applyDiscount(100000, { type: "PERCENT", value: 20, maxDiscount: 15000 })).toEqual({ discount: 15000, total: 85000 });
  });
  it("never goes below zero", () => {
    expect(applyDiscount(10000, { type: "FLAT", value: 50000 })).toEqual({ discount: 10000, total: 0 });
  });
});
