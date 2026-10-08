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

export type HikeStatus = "draft" | "published";

export type HikeSummary = {
  slug: string;
  status: HikeStatus;
  /**
   * Validated guide details (the frontmatter), for lists and the gallery. Null only when the stored
   * guide is currently invalid, which can happen with hand-edited files; open it in the editor to fix it.
   */
  details: Frontmatter | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type HikeRecord = {
  slug: string;
  /** The guide as the editor edits it: frontmatter + MDX body. */
  mdx: string;
  /** Pins, as JSON text in the house format (`{ "waypoints": [...] }`, 2-space indent). */
  waypoints: string;
  track: Track | null;
  status: HikeStatus;
  /** Opaque token for "the state I loaded"; send it back with a save. */
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type HikeContent = { mdx: string; waypoints: string };

export type WriteOptions = {
  editor: Editor | null;
  /** The version the change is based on. A save is refused if the hike has moved on since. */
  baseVersion: string;
};

export type WriteResult =
  | { ok: true; version: string; status: HikeStatus; /** The status before a save, when there was one. */ previousStatus?: HikeStatus }
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
  readonly kind: "local" | "supabase";
  list(): Promise<HikeSummary[]>;
  read(slug: string): Promise<HikeRecord | null>;
  save(slug: string, content: HikeContent, opts: WriteOptions): Promise<WriteResult>;
  /** `track` is checked by the store, so it can be passed as received. */
  create(slug: string, content: HikeContent & { track?: unknown }, opts: { editor: Editor | null }): Promise<WriteResult>;
  setTrack(slug: string, track: Track | null, opts: WriteOptions): Promise<WriteResult>;
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
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type RawWrite = Pick<RawHike, "mdx" | "waypoints" | "track" | "status"> & { details: Frontmatter };

export type BackendResult = { ok: true; version: string } | { ok: false; kind: "conflict"; version: string } | { ok: false; kind: "not_found" } | { ok: false; kind: "exists" };

export interface StoreBackend {
  readonly kind: "local" | "supabase";
  list(): Promise<Omit<RawHike, "mdx" | "waypoints" | "waypointsText" | "track">[]>;
  get(slug: string): Promise<RawHike | null>;
  /** Insert; fails with "exists" if the slug is taken. */
  insert(slug: string, data: RawWrite, editor: Editor | null): Promise<BackendResult>;
  /** Replace, only if the stored version is still `baseVersion` (checked atomically where the backend can). */
  update(slug: string, data: RawWrite, baseVersion: string, editor: Editor | null): Promise<BackendResult>;
  /** Delete, only if it's still a draft at `baseVersion` (checked atomically where the backend can). */
  deleteDraft(slug: string, baseVersion: string): Promise<DeleteResult>;
  remove(slug: string): Promise<void>;
}
