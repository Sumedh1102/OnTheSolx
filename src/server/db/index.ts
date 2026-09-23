import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

const globalForDb = globalThis as unknown as { __smashpointPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.");
  }
  // Serverless instances are many and short-lived: keep each one's pool small and let idle
  // connections go quickly. Use your provider's pooled URL (e.g. Neon "-pooler") there.
  const serverless = !!process.env.VERCEL;
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? (serverless ? 5 : 10)),
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Reuse the pool across hot reloads in development.
const pool = globalForDb.__smashpointPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__smashpointPool = pool;

export const db: Database = drizzle(pool, { schema });
export { schema };
