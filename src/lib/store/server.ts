import "server-only";
import { localBackend } from "./local";
import { createStore } from "./store";
import { serviceClient, supabaseBackend } from "./supabase";
import type { ContentStore } from "./types";

/**
 * Which store this server uses, from CONTENT_STORE:
 *   local    → files in content/hikes (the default: `pnpm dev`, and production until it's switched)
 *   supabase → the database; needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Chosen explicitly rather than by "is the key present", so a missing key is a loud error at
 * build or request time instead of the site quietly serving the files baked into the deploy.
 */
export const contentStoreKind = (): "local" | "supabase" => (process.env.CONTENT_STORE === "supabase" ? "supabase" : "local");

let store: Promise<ContentStore> | undefined;

export function getStore(): Promise<ContentStore> {
  store ??= make();
  return store;
}

async function make(): Promise<ContentStore> {
  if (contentStoreKind() === "local") return createStore(localBackend());
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
