/**
 * Production configuration checks, run once when the server starts (src/instrumentation.ts).
 * Errors stop the server from booting with an unsafe configuration; warnings are logged.
 * Pure function so it can be unit-tested.
 */
type Env = Record<string, string | undefined>;

const PLACEHOLDER_SECRETS = new Set(["change-me", "change-me-to-a-long-random-string-of-at-least-32-chars"]);

export function checkProductionEnv(env: Env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const demo = env.DEMO_MODE === "true";

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set.");

  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret)) {
    errors.push("AUTH_SECRET must be a random string of at least 32 characters (generate one with `openssl rand -base64 32`).");
  }

  const provider = env.PAYMENT_PROVIDER || "mock";
  if (provider === "mock" && !demo) {
    errors.push(
      "PAYMENT_PROVIDER is 'mock' (the sandbox gateway, which lets anyone mark a payment as paid). " +
        "Set PAYMENT_PROVIDER=razorpay for real payments, or DEMO_MODE=true for a public demo.",
    );
  }
  if (provider === "razorpay") {
    for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) {
      if (!env[key]) errors.push(`${key} is required when PAYMENT_PROVIDER=razorpay.`);
    }
  }

  const siteUrl = env.NEXT_PUBLIC_SITE_URL || (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!siteUrl) warnings.push("NEXT_PUBLIC_SITE_URL is not set; links in emails, receipts and the sitemap will point at localhost.");
  else if (!siteUrl.startsWith("https://")) warnings.push(`NEXT_PUBLIC_SITE_URL (${siteUrl}) is not https.`);

  const cron = env.CRON_SECRET ?? "";
  if (!cron || PLACEHOLDER_SECRETS.has(cron)) warnings.push("CRON_SECRET is not set; reminders and hold/membership expiry jobs will not run.");
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY is not set; emails (including password resets) will not be sent.");
  if (demo) warnings.push("DEMO_MODE is on: demo accounts are shown on the login page and the sandbox payment gateway is allowed.");

  return { errors, warnings };
}
