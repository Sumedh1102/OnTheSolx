import "server-only";
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db";

/**
 * Next sequential student code (SPA-0001…). Serialised with a transaction-scoped advisory
 * lock so concurrent registrations never collide. Must be called inside a transaction.
 */
export async function nextStudentCode(tx: DbOrTx): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('student_code'))`);
  const res = await tx.execute(sql`SELECT coalesce(max(substring(student_code from 5)::int), 0) AS n FROM students WHERE student_code ~ '^SPA-[0-9]+$'`);
  const n = Number((res.rows[0] as { n: number | string }).n) + 1;
  return `SPA-${String(n).padStart(4, "0")}`;
}
