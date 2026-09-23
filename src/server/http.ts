import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { fieldErrorsOf } from "@/lib/validation";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

/** Maps thrown errors to safe JSON responses. */
export function errorResponse(err: unknown, extra?: Record<string, unknown>) {
  if (err instanceof z.ZodError) return json({ error: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(err), ...extra }, { status: 422 });
  if (err instanceof DomainError) return json({ error: err.message, code: err.code, ...extra }, { status: err.status });
  if (err instanceof AuthError) return json({ error: err.message, code: "FORBIDDEN", ...extra }, { status: 403 });
  console.error("[api] unexpected error", err);
  return json({ error: "Something went wrong. Please try again.", ...extra }, { status: 500 });
}

/** CSRF defence for cookie-authenticated JSON endpoints: the Origin must match our host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) don't send cookies cross-site
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new AuthError("Cross-origin request blocked.");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
}

export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new DomainError("Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("Invalid JSON body.");
  }
}
