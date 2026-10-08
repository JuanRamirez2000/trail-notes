import { connect } from "../../src/db/client";
import { localBackend } from "../../src/lib/store/local";
import { postgresBackend } from "../../src/lib/store/postgres";
import { createStore } from "../../src/lib/store/store";
import type { ContentStore, WriteResult } from "../../src/lib/store/types";

/** A database connection for a script, from DATABASE_URL (.env.local). Closes itself once idle so the script can exit. */
export function scriptDatabase(what: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`${what} needs DATABASE_URL in .env.local (see .env.example)`);
  return connect(url, { idleSeconds: 1 });
}

/** The content store a script writes to: files in content/hikes (default), or the database with `--guides postgres`. */
export async function scriptStore(kind: string | undefined): Promise<ContentStore> {
  if (!kind || kind === "local") return createStore(localBackend());
  if (kind !== "postgres") throw new Error(`"${kind}" isn't a store: use "local" (files, the default) or "postgres" (the database)`);
  return createStore(postgresBackend(scriptDatabase("The database store")));
}

/** Throws a readable error for a write the store refused. */
export function mustWrite(result: WriteResult, what: string): asserts result is Extract<WriteResult, { ok: true }> {
  if (result.ok) return;
  if (result.kind === "invalid") throw new Error(`${what} was refused:\n  ${result.problems.join("\n  ")}`);
  if (result.kind === "conflict") throw new Error(`${what}: the hike changed while this ran (someone saved it). Run the command again.`);
  throw new Error(`${what}: ${result.kind}`);
}
