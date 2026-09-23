import { describe, expect, it } from "vitest";
import { can, isStaff } from "./rbac";

describe("rbac", () => {
  it("gives admins full access", () => {
    expect(can("ADMIN", "settings:manage")).toBe(true);
    expect(can("ADMIN", "payments:refund")).toBe(true);
  });

  it("limits reception to bookings, students and payments", () => {
    expect(can("RECEPTION", "bookings:manage")).toBe(true);
    expect(can("RECEPTION", "students:manage")).toBe(true);
    expect(can("RECEPTION", "payments:record")).toBe(true);
    expect(can("RECEPTION", "payments:refund")).toBe(false);
    expect(can("RECEPTION", "reports:view")).toBe(false);
  });

  it("lets coaches mark attendance but not manage payments", () => {
    expect(can("COACH", "attendance:mark")).toBe(true);
    expect(can("COACH", "performance:manage")).toBe(true);
    expect(can("COACH", "payments:view")).toBe(false);
  });

  it("denies students every staff permission", () => {
    expect(isStaff("STUDENT")).toBe(false);
    expect(can("STUDENT", "students:view")).toBe(false);
    expect(can(null, "students:view")).toBe(false);
  });
});
