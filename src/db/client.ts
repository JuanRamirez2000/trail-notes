import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

/**
 * A Drizzle connection to the guides database. `url` is a Postgres connection string with the
 * database password in it: server and scripts only, never a `NEXT_PUBLIC_` variable.
 *
 * With Supabase, use the transaction pooler's address (port 6543): it works from Vercel's
 * serverless functions and over IPv4. The pooler doesn't keep prepared statements, so they're off.
 * Idle connections close after `idleSeconds`, so a script can exit when it's done.
 */
export function connect(url: string, { idleSeconds = 20 }: { idleSeconds?: number } = {}): Database {
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: idleSeconds });
  return drizzle({ client, schema, casing: "snake_case" });
}
