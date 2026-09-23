/**
 * Release step, run on every deploy before the new version serves traffic
 * (`npm run db:deploy`; the Vercel build and the Docker entrypoint call it):
 *   1. apply pending migrations (serialised with an advisory lock)
 *   2. on an empty database with SEED_DEMO_DATA=true, load the demo academy;
 *      otherwise run the idempotent production setup (catalogue + admin from env).
 */
import "dotenv/config";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { seedDemo } from "./lib/demo-seed";
import { runMigrations } from "./lib/migrate";
import { setupProduction } from "./lib/setup";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const db = drizzle(pool, { schema });
  try {
    console.log("⏳ Applying migrations…");
    await runMigrations(pool);
    console.log("✅ Database schema is up to date");

    const [{ n: users } = { n: 0 }] = await db.select({ n: count() }).from(schema.users);
    if (process.env.SEED_DEMO_DATA === "true" && users === 0) {
      await seedDemo(db);
    } else {
      const done = await setupProduction(db, process.env);
      console.log(done.length ? `✅ Set up: ${done.join(", ")}` : "✅ Nothing to set up");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Deploy step failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
