import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

/** Minimal in-memory rate limiter (per process). Swap for Redis/Upstash when running multiple instances. */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count++;
  return bucket.count > limit ? { ok: false, retryAfterMs: bucket.resetAt - now } : { ok: true, retryAfterMs: 0 };
}
