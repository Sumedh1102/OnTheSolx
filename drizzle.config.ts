import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://smashpoint:smashpoint@localhost:5432/smashpoint",
  },
  strict: true,
  verbose: true,
});
