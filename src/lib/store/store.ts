import { trackSchema, formatIssues } from "../schemas";
import type { ContentStore, HikeRecord, RawHike, RawWrite, StoreBackend, WriteResult } from "./types";
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
      return rows.map(({ slug, status, details, publishedDetails, changed, updatedAt, updatedBy }) => ({ slug, status, details, publishedDetails, changed, updatedAt, updatedBy }));
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

    deleteDraft: (slug, { baseVersion }) => backend.deleteDraft(slug, baseVersion),

    remove: (slug) => backend.remove(slug),
  };
}
