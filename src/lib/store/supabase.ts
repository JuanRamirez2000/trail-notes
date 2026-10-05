import type { SupabaseClient } from "@supabase/supabase-js";
import type { Frontmatter, Track } from "../schemas";
import type { BackendResult, Editor, HikeStatus, RawHike, RawWrite, StoreBackend } from "./types";

/**
 * Guides in Supabase Postgres (tables and functions: supabase/migrations). `client` must be made
 * with the service-role key: the tables are locked to everything else by row-level security.
 * That key bypasses row-level security, so this module is only ever used on the server and in
 * local scripts; never import it from client code.
 *
 * The version is the row's integer `version`. A save runs in one database function that updates
 * only if the version still matches and writes the history row in the same transaction.
 */
type Row = {
  slug: string;
  mdx: string;
  waypoints: unknown;
  track: Track | null;
  details: Frontmatter;
  status: HikeStatus;
  version: number;
  updated_at: string;
  updated_by_label: string | null;
};

const SUMMARY = "slug, details, status, version, updated_at, updated_by_label";

const label = (editor: Editor | null) => (editor ? (editor.email ?? editor.name) : "script");
/** Only real auth users go in the uuid column; scripts and the local dev owner are recorded by label. */
const userId = (editor: Editor | null) => (editor && /^[0-9a-f-]{36}$/i.test(editor.id) ? editor.id : null);

export function supabaseBackend(client: SupabaseClient): StoreBackend {
  const fail = (what: string, error: { message: string }) => new Error(`Supabase: ${what}: ${error.message}`);

  const rpcResult = (data: unknown): { result: string; version: number | null } => {
    const row = Array.isArray(data) ? data[0] : data;
    return row as { result: string; version: number | null };
  };

  return {
    kind: "supabase",

    async list() {
      const { data, error } = await client.from("hikes").select(SUMMARY).order("slug");
      if (error) throw fail("list hikes", error);
      return (data as unknown as Omit<Row, "mdx" | "waypoints" | "track">[]).map((r) => ({
        slug: r.slug,
        details: r.details,
        status: r.status,
        version: String(r.version),
        updatedAt: r.updated_at,
        updatedBy: r.updated_by_label,
      }));
    },

    async get(slug): Promise<RawHike | null> {
      const { data, error } = await client.from("hikes").select("*").eq("slug", slug).maybeSingle();
      if (error) throw fail(`read ${slug}`, error);
      if (!data) return null;
      const r = data as Row;
      return {
        slug: r.slug,
        mdx: r.mdx,
        waypoints: r.waypoints,
        track: r.track,
        details: r.details,
        status: r.status,
        version: String(r.version),
        updatedAt: r.updated_at,
        updatedBy: r.updated_by_label,
      };
    },

    async insert(slug, data: RawWrite, editor): Promise<BackendResult> {
      const { data: out, error } = await client.rpc("create_hike", {
        p_slug: slug,
        p_mdx: data.mdx,
        p_waypoints: data.waypoints,
        p_track: data.track,
        p_details: data.details,
        p_status: data.status,
        p_editor: userId(editor),
        p_editor_label: label(editor),
      });
      if (error) throw fail(`create ${slug}`, error);
      const { result, version } = rpcResult(out);
      return result === "ok" ? { ok: true, version: String(version) } : { ok: false, kind: "exists" };
    },

    async update(slug, data: RawWrite, baseVersion, editor): Promise<BackendResult> {
      const base = Number(baseVersion);
      // A version that isn't one of ours can't match anything: report it as stale, with the current one.
      const { data: out, error } = await client.rpc("save_hike", {
        p_slug: slug,
        p_mdx: data.mdx,
        p_waypoints: data.waypoints,
        p_track: data.track,
        p_details: data.details,
        p_status: data.status,
        p_base_version: Number.isInteger(base) ? base : -1,
        p_editor: userId(editor),
        p_editor_label: label(editor),
      });
      if (error) throw fail(`save ${slug}`, error);
      const { result, version } = rpcResult(out);
      if (result === "ok") return { ok: true, version: String(version) };
      if (result === "conflict") return { ok: false, kind: "conflict", version: String(version) };
      return { ok: false, kind: "not_found" };
    },

    async remove(slug) {
      const a = await client.from("hike_revisions").delete().eq("slug", slug);
      if (a.error) throw fail(`remove history of ${slug}`, a.error);
      const b = await client.from("hikes").delete().eq("slug", slug);
      if (b.error) throw fail(`remove ${slug}`, b.error);
    },
  };
}

/** A service-role client for the store. `key` must never reach a browser. */
export async function serviceClient(url: string, key: string): Promise<SupabaseClient> {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
