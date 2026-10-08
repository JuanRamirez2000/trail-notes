import "server-only";
import { connect, type Database } from "../../db/client";
import { localBackend } from "./local";
import { postgresBackend } from "./postgres";
import { createStore } from "./store";
import type { ContentStore } from "./types";

/**
 * Which store this server uses, from CONTENT_STORE:
 *   local    → files in content/hikes (the default: `pnpm dev`, tests)
 *   postgres → the database (Supabase in production) through Drizzle; needs DATABASE_URL
 *
 * Chosen explicitly rather than by "is a connection string present", so a missing one is a loud
 * error at build or request time instead of the site quietly serving the files baked into the
 * deploy. A value that is neither (a typo, or the retired "supabase") is an error for the same reason.
 */
const KINDS = ["local", "postgres"] as const;

export function contentStoreKind(): (typeof KINDS)[number] {
  const kind = process.env.CONTENT_STORE || "local";
  if (!(KINDS as readonly string[]).includes(kind)) throw new Error(`CONTENT_STORE must be one of ${KINDS.join(", ")}, not "${kind}".`);
  return kind as (typeof KINDS)[number];
}

let store: Promise<ContentStore> | undefined;

export function getStore(): Promise<ContentStore> {
  store ??= Promise.resolve().then(() => (contentStoreKind() === "local" ? createStore(localBackend()) : createStore(postgresBackend(getDatabase()))));
  return store;
}

let db: Database | undefined;

/** The database connection: server only, it connects as the database owner (row-level security doesn't apply). */
export function getDatabase(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (server-only) must be set: the database's connection string. See .env.example.");
  db ??= connect(url);
  return db;
}
