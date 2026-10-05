import { trackSchema, formatIssues } from "../schemas";
import type { ContentStore, HikeRecord, HikeStatus, RawHike, RawWrite, StoreBackend, WriteResult } from "./types";
import { setDraftFlag, validateHike, waypointsText } from "./validate";

const toRecord = (h: RawHike): HikeRecord => ({
  slug: h.slug,
  mdx: h.mdx,
  waypoints: h.waypointsText ?? waypointsText(h.waypoints),
  track: h.track,
  status: h.status,
  version: h.version,
  updatedAt: h.updatedAt,
  updatedBy: h.updatedBy,
});

/**
 * A ContentStore over any backend. All the rules live here, once:
 *  - nothing reaches a backend without passing validateHike (schemas + MDX compile + no code)
 *  - every change is based on a version, and a stale one is refused instead of overwriting
 *  - status comes from the guide's `draft` flag, so files and database agree on what's public
 */
export function createStore(backend: StoreBackend): ContentStore {
  const statusOf = (draft: boolean): HikeStatus => (draft ? "draft" : "published");

  async function prepare(slug: string, mdx: string, waypoints: string) {
    const v = await validateHike(slug, mdx, waypoints);
    if (!v.ok) return v;
    const data: Omit<RawWrite, "track"> = { mdx: v.mdx, waypoints: v.waypoints, details: v.details, status: statusOf(v.details.draft) };
    return { ok: true as const, data };
  }

  return {
    kind: backend.kind,

    async list() {
      const rows = await backend.list();
      return rows.map(({ slug, status, details, updatedAt, updatedBy }) => ({ slug, status, details, updatedAt, updatedBy }));
    },

    async read(slug) {
      const h = await backend.get(slug);
      return h ? toRecord(h) : null;
    },

    async save(slug, content, { editor, baseVersion }): Promise<WriteResult> {
      const current = await backend.get(slug);
      if (!current) return { ok: false, kind: "not_found" };
      const p = await prepare(slug, content.mdx, content.waypoints);
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      const r = await backend.update(slug, { ...p.data, track: current.track }, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: p.data.status } : r;
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
      return r.ok ? { ok: true, version: r.version, status: p.data.status } : r;
    },

    async setStatus(slug, status, { editor, baseVersion }): Promise<WriteResult> {
      const current = await backend.get(slug);
      if (!current) return { ok: false, kind: "not_found" };
      const p = await prepare(slug, setDraftFlag(current.mdx, status === "draft"), current.waypointsText ?? waypointsText(current.waypoints));
      if (!p.ok) return { ok: false, kind: "invalid", problems: p.problems };
      const r = await backend.update(slug, { ...p.data, track: current.track }, baseVersion, editor);
      return r.ok ? { ok: true, version: r.version, status: p.data.status } : r;
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
      return r.ok ? { ok: true, version: r.version, status: p.data.status } : r;
    },

    remove: (slug) => backend.remove(slug),
  };
}
