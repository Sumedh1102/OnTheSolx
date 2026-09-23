import "server-only";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

export async function audit(actorId: string | null | undefined, action: string, entity: string, entityId?: string | null, meta?: Record<string, unknown>) {
  try {
    await db.insert(auditLogs).values({ actorId: actorId ?? null, action, entity, entityId: entityId ?? null, meta: meta ?? null });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
