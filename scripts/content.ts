/**
 * Guides between the repo's files and the database.
 *
 *   pnpm content check                  every guide in content/hikes passes the save gate (CI runs this)
 *   pnpm content check --store postgres the same for every guide in the database (read-only)
 *   pnpm content seed [slug] [--force]  copy content/hikes → the database, through the store
 *   pnpm content pull [slug]            copy the database → content/hikes (refresh the repo's copy on purpose)
 *
 * `content/hikes` is a working folder on this machine, not part of the repo; in production the database is what
 * the site shows. Seeding never overwrites a stored guide that differs unless --force is given.
 * The database commands need DATABASE_URL (.env.local).
 */
import { parseArgs } from "node:util";
import { localBackend } from "../src/lib/store/local";
import { createStore } from "../src/lib/store/store";
import type { ContentStore, WriteResult } from "../src/lib/store/types";
import { scriptStore } from "./lib/stores";
import { validateHike } from "../src/lib/store/validate";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { store: { type: "string", default: "local" }, force: { type: "boolean", default: false } },
});
const [cmd, only] = positionals;

const local = () => createStore(localBackend());
/** The database, for seed and pull (and `check --store postgres`). */
const remote = () => scriptStore(values.store === "local" ? "postgres" : values.store);

const slugsOf = async (store: ContentStore) => (await store.list()).map((h) => h.slug).filter((s) => !only || s === only);

async function check() {
  const store = values.store === "local" ? local() : await remote();
  const slugs = await slugsOf(store);
  if (!slugs.length) throw new Error(`No guides found in the ${store.kind} store${only ? ` for "${only}"` : ""}`);
  let bad = 0;
  for (const slug of slugs) {
    const hike = (await store.read(slug))!;
    // The working copy and, when there is one, the published copy (what the site renders).
    const copies = [["working", hike], ...(hike.published ? [["published", hike.published] as const] : [])] as const;
    const problems: string[] = [];
    for (const [name, copy] of copies) {
      const v = await validateHike(slug, copy.mdx, copy.waypoints);
      if (!v.ok) problems.push(...v.problems.map((p) => `${name} copy: ${p}`));
    }
    if (!problems.length) console.log(`  ✓ ${slug} (${hike.status}${hike.changed ? ", unpublished changes" : ""})`);
    else {
      bad++;
      console.error(`  ✗ ${slug}\n${problems.map((p) => `      ${p}`).join("\n")}`);
    }
  }
  if (bad) throw new Error(`${bad} of ${slugs.length} guide(s) in the ${store.kind} store would not render`);
  console.log(`✓ all ${slugs.length} guide(s) in the ${store.kind} store pass the save gate`);
}

type Copy = { mdx: string; waypoints: string };
const same = (a: Copy | null | undefined, b: Copy | null | undefined) => (!a || !b ? !a && !b : a.mdx === b.mdx && JSON.stringify(JSON.parse(a.waypoints)) === JSON.stringify(JSON.parse(b.waypoints)));

/** Makes each guide in `to` match `from`: the working copy, the published copy (or none) and the track. */
async function copy(from: ContentStore, to: ContentStore) {
  const slugs = await slugsOf(from);
  if (!slugs.length) throw new Error(`Nothing to copy${only ? ` for "${only}"` : ""}`);
  for (const slug of slugs) {
    const src = (await from.read(slug))!;
    const dst = await to.read(slug);
    const sameTrack = JSON.stringify(dst?.track ?? null) === JSON.stringify(src.track);
    if (dst && same(dst, src) && same(dst.published, src.published) && sameTrack) {
      console.log(`  = ${slug} already up to date`);
      continue;
    }
    if (dst && !values.force) {
      console.log(`  ! ${slug} differs in the ${to.kind} store; left alone (use --force to overwrite it)`);
      process.exitCode = 1;
      continue;
    }
    try {
      const ok = (r: WriteResult, what: string) => {
        if (!r.ok) throw new Error(`${what}: ${r.kind === "invalid" ? r.problems.join("; ") : r.kind}`);
        return r.version;
      };
      // The published copy goes through the working copy, then the working copy is put back on top.
      let working: Copy = src.published ?? src;
      let version = dst
        ? dst.version
        : ok(await to.create(slug, { mdx: working.mdx, waypoints: working.waypoints, track: src.track }, { editor: null }), "create");
      if (dst) {
        working = dst;
        if (!sameTrack) version = ok(await to.setTrack(slug, src.track, { editor: null, baseVersion: version }), "track");
      }
      if (src.published) {
        if (!same(working, src.published)) version = ok(await to.save(slug, src.published, { editor: null, baseVersion: version }), "save published copy");
        if (!same(dst?.published, src.published) || !same(working, src.published)) ok(await to.publish(slug, { editor: null, baseVersion: version }), "publish");
        working = src.published;
      } else if (dst?.published) ok(await to.unpublish(slug, { editor: null, baseVersion: version }), "unpublish");
      if (!same(working, src)) ok(await to.save(slug, { mdx: src.mdx, waypoints: src.waypoints }, { editor: null, baseVersion: version }), "save working copy");
      console.log(dst ? `  ↻ ${slug} overwritten (${src.status})` : `  + ${slug} created (${src.status})`);
    } catch (e) {
      console.log(`  ✗ ${slug}: ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    }
  }
}

const commands: Record<string, () => Promise<void>> = {
  check,
  seed: async () => copy(local(), await remote()),
  pull: async () => copy(await remote(), local()),
};
if (!commands[cmd]) {
  console.error("Usage: pnpm content <check|seed|pull> [slug] [--store postgres] [--force]");
  process.exit(1);
}
commands[cmd]().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
