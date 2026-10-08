import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional: only `db:migrate` needs DATABASE_URL
}

/**
 * `pnpm db:generate` compares src/db/schema.ts with the last snapshot in drizzle/meta and writes the
 * SQL migration for the difference. It never connects to a database.
 * `pnpm db:migrate` applies the migrations not yet applied to the database at DATABASE_URL.
 * How the live database is migrated is in docs/knowledge/current.md.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  // Supabase owns the auth schema and the anon/authenticated roles; only refer to them.
  entities: { roles: { provider: "supabase" } },
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
