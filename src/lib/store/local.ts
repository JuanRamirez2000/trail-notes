import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { frontmatterSchema, SLUG, trackSchema, type Track } from "../schemas";
import type { BackendResult, DeleteResult, RawHike, RawWrite, StoreBackend } from "./types";
import { splitFrontmatter, waypointsText } from "./validate";

/**
 * Guides as files: `<root>/<slug>/{index.mdx, waypoints.json, track.json?}`. Used by `pnpm dev`,
 * the scripts and the tests. Production reads the database (./supabase.ts).
 *
 * The version is a hash of the files, so an edit made outside the editor (a script, a text
 * editor, git) is noticed as a conflict too. Who saved isn't recorded; files have git for that.
 */
export function localBackend(root = path.join(process.cwd(), "content/hikes")): StoreBackend {
  const dir = (slug: string) => {
    // The slug pattern is what keeps reads and writes inside the root (no "..", no slashes).
    if (!SLUG.test(slug)) throw new Error(`Invalid slug "${slug}"`);
    return path.join(root, slug);
  };

  const versionOf = (mdx: string, waypoints: string, track: string) => createHash("sha256").update(mdx).update("\0").update(waypoints).update("\0").update(track).digest("hex").slice(0, 16);

  async function load(slug: string): Promise<RawHike | null> {
    const d = dir(slug);
    const mdxPath = path.join(d, "index.mdx");
    if (!existsSync(mdxPath)) return null;
    const mdx = await readFile(mdxPath, "utf8");
    const wpPath = path.join(d, "waypoints.json");
    const wpText = existsSync(wpPath) ? await readFile(wpPath, "utf8") : waypointsText({ waypoints: [] });
    const trackPath = path.join(d, "track.json");
    const trackText = existsSync(trackPath) ? await readFile(trackPath, "utf8") : "";
    // Files can be edited by hand, so they may be invalid. Still return them (details: null) so
    // the editor can open the guide and show what's wrong; nothing invalid can be written back.
    const details = frontmatterSchema.safeParse(safe(() => splitFrontmatter(mdx).data));
    const waypoints = safe(() => JSON.parse(wpText) as unknown);
    const track = trackText ? trackSchema.safeParse(safe(() => JSON.parse(trackText))) : null;
    return {
      slug,
      mdx,
      waypoints: waypoints ?? { waypoints: [] },
      waypointsText: wpText,
      track: track?.success ? track.data : null,
      trackUnreadable: track ? !track.success : undefined,
      details: details.success ? details.data : null,
      status: details.success && !details.data.draft ? "published" : "draft",
      version: versionOf(mdx, wpText, trackText),
      updatedAt: (await stat(mdxPath)).mtime.toISOString(),
      updatedBy: null,
    };
  }

  async function write(slug: string, data: RawWrite): Promise<string> {
    const d = dir(slug);
    await mkdir(d, { recursive: true });
    const wpText = waypointsText(data.waypoints);
    const trackText = data.track ? trackFileText(data.track) : "";
    await writeFile(path.join(d, "index.mdx"), data.mdx);
    await writeFile(path.join(d, "waypoints.json"), wpText);
    const trackPath = path.join(d, "track.json");
    if (data.track) {
      // Don't rewrite an unchanged track: it's large, and its exact bytes are part of the version.
      const existing = existsSync(trackPath) ? await readFile(trackPath, "utf8") : null;
      if (!existing || JSON.stringify(JSON.parse(existing)) !== JSON.stringify(data.track)) await writeFile(trackPath, trackText);
    } else if (existsSync(trackPath)) await rm(trackPath);
    const written = await load(slug);
    if (!written) throw new Error(`"${slug}" could not be read back after writing it`);
    return written.version;
  }

  // The version check and the three file writes aren't one step, so two saves from the same
  // base could both pass the check. Writes to a hike are queued one after another.
  const queues = new Map<string, Promise<unknown>>();
  function inTurn<T>(slug: string, work: () => Promise<T>): Promise<T> {
    const run = (queues.get(slug) ?? Promise.resolve()).then(work, work);
    queues.set(slug, run.catch(() => undefined));
    return run;
  }

  // A missing folder is an error, not "no hikes": if the files didn't ship with a deploy, a page
  // refresh must fail (and keep the last good page) rather than turn every guide into a 404.
  const missingRoot = () => {
    if (!existsSync(root)) throw new Error(`Guides folder not found: ${root}`);
  };

  return {
    kind: "local",

    async list() {
      missingRoot();
      const entries = await readdir(root, { withFileTypes: true });
      const hikes = await Promise.all(entries.filter((e) => e.isDirectory() && SLUG.test(e.name)).map((e) => load(e.name)));
      return hikes.filter((h): h is RawHike => h !== null).map(({ slug, details, status, version, updatedAt, updatedBy }) => ({ slug, details, status, version, updatedAt, updatedBy }));
    },

    async get(slug) {
      missingRoot();
      return load(slug);
    },

    insert: (slug, data) =>
      inTurn(slug, async (): Promise<BackendResult> => {
        if (existsSync(path.join(dir(slug), "index.mdx"))) return { ok: false, kind: "exists" };
        return { ok: true, version: await write(slug, data) };
      }),

    update: (slug, data, baseVersion) =>
      inTurn(slug, async (): Promise<BackendResult> => {
        const current = await load(slug);
        if (!current) return { ok: false, kind: "not_found" };
        if (current.version !== baseVersion) return { ok: false, kind: "conflict", version: current.version };
        return { ok: true, version: await write(slug, data) };
      }),

    deleteDraft: (slug, baseVersion) =>
      inTurn(slug, async (): Promise<DeleteResult> => {
        const current = await load(slug);
        if (!current) return { ok: false, kind: "not_found" };
        if (current.status !== "draft") return { ok: false, kind: "published" };
        if (current.version !== baseVersion) return { ok: false, kind: "conflict", version: current.version };
        await rm(dir(slug), { recursive: true, force: true });
        return { ok: true };
      }),

    async remove(slug) {
      await rm(dir(slug), { recursive: true, force: true });
    },
  };
}

const trackFileText = (track: Track) => `${JSON.stringify(track)}\n`;

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
