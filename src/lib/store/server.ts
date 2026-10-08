import "server-only";
import { connect } from "../../db/client";
import { localBackend } from "./local";
import { postgresBackend } from "./postgres";
import { createStore } from "./store";
import { serviceClient, supabaseBackend } from "./supabase";
import type { ContentStore } from "./types";

/**
 * Which store this server uses, from CONTENT_STORE:
 *   local    → files in content/hikes (the default: `pnpm dev`, tests)
 *   supabase → the database through supabase-js; needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   postgres → the same database through Drizzle (src/db); needs DATABASE_URL
 *
 * Chosen explicitly rather than by "is the key present", so a missing key is a loud error at
 * build or request time instead of the site quietly serving the files baked into the deploy.
 * A value that is neither (a typo) is an error for the same reason.
 */
const KINDS = ["local", "supabase", "postgres"] as const;

export function contentStoreKind(): (typeof KINDS)[number] {
  const kind = process.env.CONTENT_STORE || "local";
  if (!(KINDS as readonly string[]).includes(kind)) throw new Error(`CONTENT_STORE must be one of ${KINDS.join(", ")}, not "${kind}".`);
  return kind as (typeof KINDS)[number];
}

let store: Promise<ContentStore> | undefined;

export function getStore(): Promise<ContentStore> {
  store ??= make();
  return store;
}

async function make(): Promise<ContentStore> {
  const kind = contentStoreKind();
  if (kind === "local") return createStore(localBackend());
  if (kind === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("CONTENT_STORE=postgres needs DATABASE_URL (server-only): the database's connection string.");
    return createStore(postgresBackend(connect(url)));
  }
  return createStore(supabaseBackend(await getServiceClient()));
}

/** The service-role Supabase client. Server only: this key bypasses row-level security. */
export async function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("CONTENT_STORE=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only) to be set.");
  }
  return serviceClient(url, key);
}
