import { checkProductionEnv } from "@/lib/env-check";

/** Runs once per server instance, before it accepts requests. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { errors, warnings } = checkProductionEnv(process.env);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[config] ${e}`);
    throw new Error(`Refusing to start: ${errors.length} configuration error(s). See the log above.`);
  }
}
