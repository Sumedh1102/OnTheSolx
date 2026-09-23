import { timingSafeEqual } from "node:crypto";
import { runScheduledJobs } from "@/server/services/jobs";

/**
 * Hourly scheduler entry point (Vercel Cron, GitHub Actions, or any cron hitting this URL).
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = !!secret && secret !== "change-me" && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Unauthorized", { status: 401 });
  const result = await runScheduledJobs();
  return Response.json({ ok: true, ranAt: new Date().toISOString(), ...result });
}
