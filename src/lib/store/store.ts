import { trackSchema, formatIssues } from "../schemas";
import { DELETE_DELAY_HOURS, type ContentStore, type DeleteResult, type HikeRecord, type RawHike, type RawWrite, type StoreBackend, type WriteResult } from "./types";
import { validateHike, waypointsText } from "./validate";

/** A stored track that can't be read is never written back as "no track": that would delete it. */
const unreadableTrack: WriteResult = { ok: false, kind: "invalid", problems: ["track.json: the stored track is invalid. Fix the file, or import the recording again with `pnpm gpx`."] };

function toRecord(h: RawHike): HikeRecord {
  const waypoints = h.waypointsText ?? waypointsText(h.waypoints);
  const published = h.published ? { mdx: h.published.mdx, waypoints: h.published.waypointsText ?? waypointsText(h.published.waypoints), at: h.published.at } : null;
  return {
    slug: h.slug,
    mdx: h.mdx,
    waypoints,
    track: h.track,
    status: h.status,
    published,
    changed: !!published && (published.mdx !== h.mdx || published.waypoints !== waypoints),
    deleteAfter: h.deleteAfter,
    version: h.version,
    updatedAt: h.updatedAt,
    updatedBy: h.updatedBy,
  };
}

/**
 * A ContentStore over any backend. All the rules live here, once:
 *  - nothing reaches a backend without passing validateHike (schemas + MDX compile + no code)
 *  - every change is based on a version, and a stale one is refused instead of overwriting
 *  - saves only ever change the working copy; the public site changes on publish and unpublish
 */
export function createStore(backend: StoreBackend): ContentStore {
  async function prepare(slug: string, mdx: string, waypoints: string) {
    const v = await validateHike(slug, mdx, waypoints);
    if (!v.ok) return v;
    const data: Omit<RawWrite, "track"> = { mdx: v.mdx, waypoints: v.waypoints, details: v.details };
    return { ok: true as const, data };
  }

  return {
    kind: backend.kind,

    async list() {
      const rows = await backend.list();
      return rows.map(({ slug, status, details, publishedDetails, changed, deleteAfter, updatedAt, updatedBy }) => ({ slug, status, details, publishedDetails, changed, deleteAfter, updatedAt, updatedBy }));
    },

    async read(slug) {
      const h = await backend.get(slug);
      return h ? toRecord(h) : null;
    },

    async save(slug, content, { editor, baseVersion }): Promise<WriteResult> {
      const current = await backend.get(slug);
      if (!current) return { ok: false, kind: "not_found" };
      if (current.trackUnreadable) return unreadableTrack;
      const p = await prepare(slug, content.mdx, content.waypoints);
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      const r = await backend.update(slug, { ...p.data, track: current.track }, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: current.status } : r;
    },

    async publish(slug, { editor, baseVersion }): Promise<WriteResult> {
      const current = await backend.get(slug);
      if (!current) return { ok: false, kind: "not_found" };
      if (current.deleteAfter) return { ok: false, kind: "invalid", problems: ["This hike is scheduled for deletion. Restore it before publishing."] };
      // Saves are validated, but files can be edited by hand: nothing invalid goes public.
      const p = await prepare(slug, current.mdx, current.waypointsText ?? waypointsText(current.waypoints));
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      const r = await backend.publish(slug, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: "published" } : r;
    },

    async unpublish(slug, { editor, baseVersion }): Promise<WriteResult> {
      const r = await backend.unpublish(slug, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: "draft" } : r;
    },

    async create(slug, content, { editor }): Promise<WriteResult> {
      const p = await prepare(slug, content.mdx, content.waypoints);
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      let track = null;
      if (content.track) {
        const t = trackSchema.safeParse(content.track);
        if (!t.success) return { ok: false, kind: "invalid", problems: formatIssues(t.error).map((m) => `track.json: ${m}`) };
        track = t.data;
      }
      const r = await backend.insert(slug, { ...p.data, track }, editor);
      return r.ok ? { ok: true, version: r.version, status: "draft" } : r;
    },

    async setTrack(slug, track, { editor, baseVersion }): Promise<WriteResult> {
      const current = await backend.get(slug);
      if (!current) return { ok: false, kind: "not_found" };
      let next = null;
      if (track) {
        const t = trackSchema.safeParse(track);
        if (!t.success) return { ok: false, kind: "invalid", problems: formatIssues(t.error).map((m) => `track.json: ${m}`) };
        next = t.data;
      }
      // Re-validate what's stored: a track can't be attached to a guide that is currently invalid.
      const p = await prepare(slug, current.mdx, current.waypointsText ?? waypointsText(current.waypoints));
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      const r = await backend.update(slug, { ...p.data, track: next }, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: current.status } : r;
    },

    history: (slug, limit = 100) => backend.history(slug, limit),

    async revision(slug, version) {
      const r = await backend.revision(slug, version);
      return r ? { mdx: r.mdx, waypoints: waypointsText(r.waypoints) } : null;
    },

    async scheduleDelete(slug, { editor, baseVersion, now = new Date() }): Promise<DeleteResult> {
      const deleteAfter = new Date(now.getTime() + DELETE_DELAY_HOURS * 3_600_000).toISOString();
      const r = await backend.scheduleDelete(slug, baseVersion, deleteAfter, editor);
      if (r.ok) return { ok: true, deleteAfter };
      // "exists" is an insert's answer; a schedule can only be stale or aimed at nothing.
      return r.kind === "conflict" ? r : { ok: false, kind: "not_found" };
    },

    cancelDelete: async (slug) => ((await backend.cancelDelete(slug)) ? { ok: true } : { ok: false, kind: "not_found" }),

    remove: (slug) => backend.remove(slug),
  };
}
