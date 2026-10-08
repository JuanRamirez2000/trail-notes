import type { Frontmatter, Track } from "../schemas";

/**
 * Where guides live. The editor, the site and the scripts only ever talk to a ContentStore, so the
 * same code runs against files in `content/hikes` (local dev, tests) and against Supabase (production).
 *
 * Every write goes through `createStore()` in ./store.ts, which validates before a backend is
 * touched. A backend (./local.ts, ./supabase.ts) only knows how to read and write raw records.
 */

/** Who is making a change. Recorded with every save; null for scripts (seeding, ingest). */
export type Editor = { id: string; name: string; email?: string; role: EditorRole };
export type EditorRole = "owner" | "editor";

/**
 * Every guide has a working copy, which the editor saves to, and may have a published copy, which
 * is what the public site shows. "published" means there is a published copy.
 */
export type HikeStatus = "draft" | "published";

export type HikeSummary = {
  slug: string;
  status: HikeStatus;
  /**
   * Validated details (the frontmatter) of the working copy, for the editor's list. Null only when
   * the stored guide is currently invalid, which can happen with hand-edited files; open it in the
   * editor to fix it.
   */
  details: Frontmatter | null;
  /** Details of the published copy, for the gallery; null when there is none. */
  publishedDetails: Frontmatter | null;
  /** Published, and the working copy has changes the site doesn't show yet. */
  changed: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** The published copy of a guide. */
export type PublishedCopy = HikeContent & { at: string | null };

export type HikeRecord = {
  slug: string;
  /** The guide as the editor edits it: frontmatter + MDX body. */
  mdx: string;
  /** Pins, as JSON text in the house format (`{ "waypoints": [...] }`, 2-space indent). */
  waypoints: string;
  track: Track | null;
  status: HikeStatus;
  /** What the public site shows, or null for a draft. */
  published: PublishedCopy | null;
  /** Published, and the working copy differs from it. */
  changed: boolean;
  /** Opaque token for "the state I loaded"; send it back with a save. */
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type HikeContent = { mdx: string; waypoints: string };

/** One saved version of a guide, from its history. */
export type Revision = { version: string; savedAt: string; savedBy: string | null; status: HikeStatus };

export type WriteOptions = {
  editor: Editor | null;
  /** The version the change is based on. A save is refused if the hike has moved on since. */
  baseVersion: string;
};

export type WriteResult =
  | { ok: true; version: string; status: HikeStatus }
  | { ok: false; kind: "invalid"; problems: string[] }
  | { ok: false; kind: "conflict"; version: string }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "exists" };

export type DeleteResult =
  | { ok: true }
  | { ok: false; kind: "conflict"; version: string }
  | { ok: false; kind: "not_found" }
  /** Only drafts can be deleted; a published guide has to be unpublished first. */
  | { ok: false; kind: "published" };

export interface ContentStore {
  readonly kind: "local" | "postgres";
  list(): Promise<HikeSummary[]>;
  read(slug: string): Promise<HikeRecord | null>;
  /** Saves the working copy. The published copy, and so the public site, doesn't change. */
  save(slug: string, content: HikeContent, opts: WriteOptions): Promise<WriteResult>;
  /** Makes the working copy, at `baseVersion`, the published copy (after validating it again). */
  publish(slug: string, opts: WriteOptions): Promise<WriteResult>;
  /** Removes the published copy: the guide is a draft again. The working copy stays. */
  unpublish(slug: string, opts: WriteOptions): Promise<WriteResult>;
  /** `track` is checked by the store, so it can be passed as received. */
  create(slug: string, content: HikeContent & { track?: unknown }, opts: { editor: Editor | null }): Promise<WriteResult>;
  setTrack(slug: string, track: Track | null, opts: WriteOptions): Promise<WriteResult>;
  /**
   * A guide's saved versions, newest first (at most `limit`). Only the database keeps history;
   * guides in files have git instead, so the local store has none.
   */
  history(slug: string, limit?: number): Promise<Revision[]>;
  /** The text and pins of one saved version, or null if there's no such version. */
  revision(slug: string, version: string): Promise<HikeContent | null>;
  /**
   * Deletes a draft from the editor, with its history: only while it's a draft, and only at the
   * version the editor last saw. There's no undo.
   */
  deleteDraft(slug: string, opts: WriteOptions): Promise<DeleteResult>;
  /** Removes a hike and its history, whatever its state. For tests and scripts. */
  remove(slug: string): Promise<void>;
}

// ── What a backend implements ─────────────────────────────────────────────

/** A stored hike, as the backend holds it. Everything here has already been validated on the way in. */
export type RawHike = {
  slug: string;
  mdx: string;
  /** Parsed `{ waypoints: [...] }`. */
  waypoints: unknown;
  /** The pins' exact stored text, when the backend keeps text (files). Preserved so a read never reformats or loses it. */
  waypointsText?: string;
  track: Track | null;
  /** True when a track is stored but doesn't validate (hand-edited files); `track` is then null. */
  trackUnreadable?: boolean;
  /** Null when what's stored doesn't validate (hand-edited files). */
  details: Frontmatter | null;
  status: HikeStatus;
  /** The published copy, as stored (`waypoints` parsed; `waypointsText` when the backend keeps text). */
  published: { mdx: string; waypoints: unknown; waypointsText?: string; details: Frontmatter | null; at: string | null } | null;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** A write to the working copy. A new hike starts as a draft; only publish/unpublish change the status. */
export type RawWrite = Pick<RawHike, "mdx" | "waypoints" | "track"> & { details: Frontmatter };

export type BackendResult = { ok: true; version: string } | { ok: false; kind: "conflict"; version: string } | { ok: false; kind: "not_found" } | { ok: false; kind: "exists" };

export interface StoreBackend {
  readonly kind: "local" | "postgres";
  list(): Promise<(Omit<RawHike, "mdx" | "waypoints" | "waypointsText" | "track" | "published"> & { publishedDetails: Frontmatter | null; changed: boolean })[]>;
  get(slug: string): Promise<RawHike | null>;
  /** Insert; fails with "exists" if the slug is taken. */
  insert(slug: string, data: RawWrite, editor: Editor | null): Promise<BackendResult>;
  /** Replace the working copy, only if the stored version is still `baseVersion` (checked atomically where the backend can). */
  update(slug: string, data: RawWrite, baseVersion: string, editor: Editor | null): Promise<BackendResult>;
  /** Copy the working copy to the published copy, only if it's still at `baseVersion`. The version doesn't change. */
  publish(slug: string, baseVersion: string, editor: Editor | null): Promise<BackendResult>;
  /** Clear the published copy, only if the working copy is still at `baseVersion`. */
  unpublish(slug: string, baseVersion: string, editor: Editor | null): Promise<BackendResult>;
  history(slug: string, limit: number): Promise<Revision[]>;
  /** `waypoints` parsed, as stored. */
  revision(slug: string, version: string): Promise<{ mdx: string; waypoints: unknown } | null>;
  /** Delete, only if it's still a draft at `baseVersion` (checked atomically where the backend can). */
  deleteDraft(slug: string, baseVersion: string): Promise<DeleteResult>;
  remove(slug: string): Promise<void>;
}
