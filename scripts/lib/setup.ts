/**
 * Production first-run setup. Idempotent and non-destructive: it only fills what is missing.
 *  - default booking / notification / attendance settings
 *  - the court, program and membership-plan catalogue (only when those tables are empty)
 *  - an admin account from ADMIN_EMAIL / ADMIN_PASSWORD (only if that email has no account)
 */
import { count, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../src/server/db/schema";
import { hashPassword } from "../../src/server/auth/password";
import { DEFAULT_ATTENDANCE_SETTINGS, DEFAULT_BOOKING_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS } from "../../src/lib/settings-types";
import { COURTS, MEMBERSHIP_PLANS, PROGRAMS } from "./catalogue";

type Db = NodePgDatabase<typeof schema>;
type Env = Record<string, string | undefined>;

const isEmpty = async (db: Db, table: typeof schema.courts | typeof schema.programs | typeof schema.membershipPlans) =>
  ((await db.select({ n: count() }).from(table))[0]?.n ?? 0) === 0;

export async function setupProduction(db: Db, env: Env) {
  const done: string[] = [];

  const inserted = await db
    .insert(schema.settings)
    .values([
      { key: "booking", value: DEFAULT_BOOKING_SETTINGS },
      { key: "notifications", value: DEFAULT_NOTIFICATION_SETTINGS },
      { key: "attendance", value: DEFAULT_ATTENDANCE_SETTINGS },
    ])
    .onConflictDoNothing()
    .returning({ key: schema.settings.key });
  if (inserted.length) done.push(`settings (${inserted.map((r) => r.key).join(", ")})`);

  if (await isEmpty(db, schema.courts)) {
    await db.insert(schema.courts).values(COURTS);
    done.push(`${COURTS.length} courts`);
  }
  if (await isEmpty(db, schema.programs)) {
    await db.insert(schema.programs).values(PROGRAMS.map(({ coachSlug: _coach, ...p }) => ({ ...p, coachId: null })));
    done.push(`${PROGRAMS.length} programs`);
  }
  if (await isEmpty(db, schema.membershipPlans)) {
    await db.insert(schema.membershipPlans).values(MEMBERSHIP_PLANS);
    done.push(`${MEMBERSHIP_PLANS.length} membership plans`);
  }

  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";
  if (email) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(sql`lower(${schema.users.email})`, email)).limit(1);
    if (!existing) {
      if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters to create the admin account.");
      await db.insert(schema.users).values({
        name: env.ADMIN_NAME?.trim() || "Academy Admin",
        email,
        phone: env.ADMIN_PHONE?.trim() || null,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      });
      done.push(`admin account ${email}`);
    }
  } else {
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
    if (n === 0) console.warn("⚠️  No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD and deploy again to create one.");
  }

  return done;
}
