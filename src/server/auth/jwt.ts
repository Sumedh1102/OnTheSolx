/**
 * Session token signing/verification. Kept free of database imports so that the proxy
 * (src/proxy.ts) can use it for fast, optimistic route protection.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/rbac";

export const SESSION_COOKIE = "sp_session";
/** Non-sensitive hint cookie readable by client JS so static pages can show "Dashboard" instead of "Login". */
export const SIGNED_IN_HINT_COOKIE = "sp_signed_in";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionClaims = { sid: string; sub: string; role: Role };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("smashpoint")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "smashpoint", algorithms: ["HS256"] });
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { sid: payload.sid, sub: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}
