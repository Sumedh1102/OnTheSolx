import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L

/** Random, non-sequential reference code, e.g. "SP-7K3D9Q". */
export function randomCode(prefix: string, length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `${prefix}-${out}`;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** HMAC signature used for capability links (e.g. a guest's booking receipt URL). */
export function signValue(value: string, purpose: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url").slice(0, 32);
}

export function verifySignedValue(value: string, purpose: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signValue(value, purpose));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const bookingAccessToken = (code: string) => signValue(code, "booking");
export const verifyBookingAccess = (code: string, token: string | null | undefined) =>
  verifySignedValue(code, "booking", token);

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across every server
 * instance (serverless functions, multiple containers). One atomic upsert per call;
 * keys are hashed so emails/IPs aren't stored in clear. Expired rows are purged by the
 * scheduled jobs.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }> {
  const hashed = `${key.split(":")[0]}:${sha256(key)}`.slice(0, 200);
  const result = await db.execute<{ count: number; reset_at: Date | string }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${hashed}, 1, now() + make_interval(secs => ${windowMs / 1000}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
    returning count, reset_at`);
  const row = result.rows[0]!;
  const retryAfterMs = Math.max(0, new Date(row.reset_at).getTime() - Date.now());
  return row.count > limit ? { ok: false, retryAfterMs } : { ok: true, retryAfterMs: 0 };
}
