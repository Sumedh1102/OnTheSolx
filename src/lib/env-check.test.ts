import { describe, expect, it } from "vitest";
import { checkProductionEnv } from "./env-check";

const base = {
  DATABASE_URL: "postgres://u:p@db/app",
  AUTH_SECRET: "x".repeat(44),
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_KEY_ID: "rzp_live_x",
  RAZORPAY_KEY_SECRET: "s",
  RAZORPAY_WEBHOOK_SECRET: "w",
  NEXT_PUBLIC_SITE_URL: "https://smashpoint.in",
  CRON_SECRET: "c".repeat(32),
  RESEND_API_KEY: "re_x",
};

describe("checkProductionEnv", () => {
  it("accepts a complete production config", () => {
    expect(checkProductionEnv(base)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects missing or placeholder secrets", () => {
    expect(checkProductionEnv({ ...base, DATABASE_URL: undefined }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...base, AUTH_SECRET: "short" }).errors[0]).toMatch(/AUTH_SECRET/);
    expect(checkProductionEnv({ ...base, AUTH_SECRET: "change-me-to-a-long-random-string-of-at-least-32-chars" }).errors[0]).toMatch(/AUTH_SECRET/);
  });

  it("refuses the sandbox gateway unless demo mode is on", () => {
    expect(checkProductionEnv({ ...base, PAYMENT_PROVIDER: "mock" }).errors[0]).toMatch(/mock/);
    expect(checkProductionEnv({ ...base, PAYMENT_PROVIDER: undefined }).errors[0]).toMatch(/mock/);
    const demo = checkProductionEnv({ ...base, PAYMENT_PROVIDER: "mock", DEMO_MODE: "true" });
    expect(demo.errors).toEqual([]);
    expect(demo.warnings.join()).toMatch(/DEMO_MODE/);
  });

  it("requires Razorpay credentials when Razorpay is selected", () => {
    expect(checkProductionEnv({ ...base, RAZORPAY_WEBHOOK_SECRET: "" }).errors[0]).toMatch(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it("falls back to the Vercel production URL and warns on non-https URLs", () => {
    expect(checkProductionEnv({ ...base, NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "smashpoint.vercel.app" }).warnings).toEqual([]);
    expect(checkProductionEnv({ ...base, NEXT_PUBLIC_SITE_URL: "http://x.in" }).warnings[0]).toMatch(/https/);
  });
});
