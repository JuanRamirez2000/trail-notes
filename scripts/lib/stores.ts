import { connect } from "../../src/db/client";
import { localBackend } from "../../src/lib/store/local";
import { postgresBackend } from "../../src/lib/store/postgres";
import { createStore } from "../../src/lib/store/store";
import { serviceClient, supabaseBackend } from "../../src/lib/store/supabase";
import type { ContentStore, WriteResult } from "../../src/lib/store/types";

/**
 * The content store a script writes to: files in content/hikes (default), or the database with
 * `--guides postgres` (Drizzle, DATABASE_URL) or `--guides supabase` (supabase-js, service-role key).
 */
export async function scriptStore(kind: string | undefined): Promise<ContentStore> {
  if (!kind || kind === "local") return createStore(localBackend());
  if (kind === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("--guides postgres needs DATABASE_URL in .env.local");
    return createStore(postgresBackend(connect(url, { idleSeconds: 1 })));
  }
  if (kind !== "supabase") throw new Error('--guides must be "local", "postgres" or "supabase"');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("--guides supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createStore(supabaseBackend(await serviceClient(url, key)));
}

/** Throws a readable error for a write the store refused. */
export function mustWrite(result: WriteResult, what: string): asserts result is Extract<WriteResult, { ok: true }> {
  if (result.ok) return;
  if (result.kind === "invalid") throw new Error(`${what} was refused:\n  ${result.problems.join("\n  ")}`);
  if (result.kind === "conflict") throw new Error(`${what}: the hike changed while this ran (someone saved it). Run the command again.`);
  throw new Error(`${what}: ${result.kind}`);
}
