import "dotenv/config";
import { Pool } from "pg";
import { runMigrations } from "./lib/migrate";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log("⏳ Running migrations…");
  await runMigrations(pool);
  console.log("✅ Migrations complete");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
