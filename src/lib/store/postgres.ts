import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { hikeRevisions, hikes } from "../../db/schema";
import type { BackendResult, DeleteResult, Editor, RawHike, RawWrite, StoreBackend } from "./types";

/**
 * Guides in Postgres through Drizzle (tables: src/db/schema.ts). In production that's the
 * Supabase database, reached with DATABASE_URL; the tests run it against a plain Postgres.
 *
 * The version is the row's integer `version`. Every change runs in one transaction: the version
 * check, the write and its history row happen together or not at all.
 */
const label = (editor: Editor | null) => (editor ? (editor.email ?? editor.name) : "script");
/** Only real auth users go in the uuid column; scripts and the local dev owner are recorded by label. */
const userId = (editor: Editor | null) => (editor && /^[0-9a-f-]{36}$/i.test(editor.id) ? editor.id : null);
/** A version that isn't one of ours can't match anything; it's then reported as stale. */
const asVersion = (v: string) => (/^\d+$/.test(v) ? Number(v) : -1);

const summary = {
  slug: hikes.slug,
  details: hikes.details,
  status: hikes.status,
  version: hikes.version,
  updatedAt: hikes.updatedAt,
  updatedBy: hikes.updatedByLabel,
};

export function postgresBackend(db: Database): StoreBackend {
  const current = async (tx: Pick<Database, "select">, slug: string) => (await tx.select({ status: hikes.status, version: hikes.version }).from(hikes).where(eq(hikes.slug, slug)))[0];

  return {
    kind: "postgres",

    async list() {
      const rows = await db.select(summary).from(hikes).orderBy(asc(hikes.slug));
      return rows.map((r) => ({ ...r, version: String(r.version), updatedAt: r.updatedAt.toISOString() }));
    },

    async get(slug): Promise<RawHike | null> {
      const [r] = await db.select().from(hikes).where(eq(hikes.slug, slug));
      if (!r) return null;
      return {
        slug: r.slug,
        mdx: r.mdx,
        waypoints: r.waypoints,
        track: r.track,
        details: r.details,
        status: r.status,
        version: String(r.version),
        updatedAt: r.updatedAt.toISOString(),
        updatedBy: r.updatedByLabel,
      };
    },

    insert: (slug, data: RawWrite, editor) =>
      db.transaction(async (tx): Promise<BackendResult> => {
        const [row] = await tx
          .insert(hikes)
          .values({ slug, ...data, updatedBy: userId(editor), updatedByLabel: label(editor) })
          .onConflictDoNothing()
          .returning({ version: hikes.version });
        if (!row) return { ok: false, kind: "exists" };
        await tx.insert(hikeRevisions).values({ slug, version: row.version, mdx: data.mdx, waypoints: data.waypoints, status: data.status, savedBy: userId(editor), savedByLabel: label(editor) });
        return { ok: true, version: String(row.version) };
      }),

    update: (slug, data: RawWrite, baseVersion, editor) =>
      db.transaction(async (tx): Promise<BackendResult> => {
        const [row] = await tx
          .update(hikes)
          .set({ ...data, version: sql`${hikes.version} + 1`, updatedBy: userId(editor), updatedByLabel: label(editor), updatedAt: sql`now()` })
          .where(and(eq(hikes.slug, slug), eq(hikes.version, asVersion(baseVersion))))
          .returning({ version: hikes.version });
        if (row) {
          await tx.insert(hikeRevisions).values({ slug, version: row.version, mdx: data.mdx, waypoints: data.waypoints, status: data.status, savedBy: userId(editor), savedByLabel: label(editor) });
          return { ok: true, version: String(row.version) };
        }
        const now = await current(tx, slug);
        return now ? { ok: false, kind: "conflict", version: String(now.version) } : { ok: false, kind: "not_found" };
      }),

    async history(slug, limit) {
      const rows = await db
        .select({ version: hikeRevisions.version, savedAt: hikeRevisions.savedAt, savedBy: hikeRevisions.savedByLabel, status: hikeRevisions.status })
        .from(hikeRevisions)
        .where(eq(hikeRevisions.slug, slug))
        .orderBy(desc(hikeRevisions.version))
        .limit(limit);
      return rows.map((r) => ({ ...r, version: String(r.version), savedAt: r.savedAt.toISOString() }));
    },

    async revision(slug, version) {
      const [r] = await db
        .select({ mdx: hikeRevisions.mdx, waypoints: hikeRevisions.waypoints })
        .from(hikeRevisions)
        .where(and(eq(hikeRevisions.slug, slug), eq(hikeRevisions.version, asVersion(version))));
      return r ?? null;
    },

    deleteDraft: (slug, baseVersion) =>
      db.transaction(async (tx): Promise<DeleteResult> => {
        const [row] = await tx
          .delete(hikes)
          .where(and(eq(hikes.slug, slug), eq(hikes.status, "draft"), eq(hikes.version, asVersion(baseVersion))))
          .returning({ slug: hikes.slug });
        if (row) {
          // Its history goes too, so the address can be used again from revision 1.
          await tx.delete(hikeRevisions).where(eq(hikeRevisions.slug, slug));
          return { ok: true };
        }
        const now = await current(tx, slug);
        if (!now) return { ok: false, kind: "not_found" };
        if (now.status !== "draft") return { ok: false, kind: "published" };
        return { ok: false, kind: "conflict", version: String(now.version) };
      }),

    async remove(slug) {
      await db.transaction(async (tx) => {
        await tx.delete(hikeRevisions).where(eq(hikeRevisions.slug, slug));
        await tx.delete(hikes).where(eq(hikes.slug, slug));
      });
    },
  };
}
