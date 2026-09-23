import "server-only";
import { z } from "zod";
import { AuthError } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Converts known errors into a user-safe ActionResult; unknown errors are logged, not leaked. */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof z.ZodError) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(err) };
  if (err instanceof AuthError || err instanceof DomainError) return { ok: false, error: err.message };
  // Re-throw Next.js control-flow errors (redirect / notFound).
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string") {
    const digest = (err as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw err;
  }
  console.error("[action] unexpected error", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
