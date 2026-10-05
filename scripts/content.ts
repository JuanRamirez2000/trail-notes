/**
 * Guides between the repo's files and the database.
 *
 *   pnpm content check                  every guide in content/hikes passes the save gate (CI runs this)
 *   pnpm content check --store supabase the same for every guide stored in Supabase (read-only)
 *   pnpm content seed [slug] [--force]  copy content/hikes → Supabase, through the store
 *   pnpm content pull [slug]            copy Supabase → content/hikes (refresh the repo's copy on purpose)
 *
 * `content/hikes` is seed data, fixtures and the test baseline; in production the database is what
 * the site shows. Seeding never overwrites a stored guide that differs unless --force is given.
 * The Supabase commands need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */
import { parseArgs } from "node:util";
import { localBackend } from "../src/lib/store/local";
import { createStore } from "../src/lib/store/store";
import { serviceClient, supabaseBackend } from "../src/lib/store/supabase";
import type { ContentStore } from "../src/lib/store/types";
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
async function remote(): Promise<ContentStore> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)");
  return createStore(supabaseBackend(await serviceClient(url, key)));
}

const slugsOf = async (store: ContentStore) => (await store.list()).map((h) => h.slug).filter((s) => !only || s === only);

async function check() {
  const store = values.store === "supabase" ? await remote() : local();
  const slugs = await slugsOf(store);
  if (!slugs.length) throw new Error(`No guides found in the ${store.kind} store${only ? ` for "${only}"` : ""}`);
  let bad = 0;
  for (const slug of slugs) {
    const hike = (await store.read(slug))!;
    const v = await validateHike(slug, hike.mdx, hike.waypoints);
    if (v.ok) console.log(`  ✓ ${slug} (${hike.status})`);
    else {
      bad++;
      console.error(`  ✗ ${slug}\n${v.problems.map((p) => `      ${p}`).join("\n")}`);
    }
  }
  if (bad) throw new Error(`${bad} of ${slugs.length} guide(s) in the ${store.kind} store would not render`);
  console.log(`✓ all ${slugs.length} guide(s) in the ${store.kind} store pass the save gate`);
}

async function copy(from: ContentStore, to: ContentStore) {
  const slugs = await slugsOf(from);
  if (!slugs.length) throw new Error(`Nothing to copy${only ? ` for "${only}"` : ""}`);
  for (const slug of slugs) {
    const src = (await from.read(slug))!;
    const dst = await to.read(slug);
    if (!dst) {
      const r = await to.create(slug, { mdx: src.mdx, waypoints: src.waypoints, track: src.track }, { editor: null });
      console.log(r.ok ? `  + ${slug} created (${r.status})` : `  ✗ ${slug}: ${r.kind === "invalid" ? r.problems.join("; ") : r.kind}`);
      if (!r.ok) process.exitCode = 1;
      continue;
    }
    const same = dst.mdx === src.mdx && JSON.stringify(JSON.parse(dst.waypoints)) === JSON.stringify(JSON.parse(src.waypoints));
    const sameTrack = JSON.stringify(dst.track) === JSON.stringify(src.track);
    if (same && sameTrack) {
      console.log(`  = ${slug} already up to date`);
      continue;
    }
    if (!values.force) {
      console.log(`  ! ${slug} differs in the ${to.kind} store; left alone (use --force to overwrite it)`);
      process.exitCode = 1;
      continue;
    }
    let version = dst.version;
    if (!same) {
      const r = await to.save(slug, { mdx: src.mdx, waypoints: src.waypoints }, { editor: null, baseVersion: version });
      if (!r.ok) {
        console.log(`  ✗ ${slug}: ${r.kind === "invalid" ? r.problems.join("; ") : r.kind}`);
        process.exitCode = 1;
        continue;
      }
      version = r.version;
    }
    if (!sameTrack) await to.setTrack(slug, src.track, { editor: null, baseVersion: version });
    console.log(`  ↻ ${slug} overwritten`);
  }
}

const commands: Record<string, () => Promise<void>> = {
  check,
  seed: async () => copy(local(), await remote()),
  pull: async () => copy(await remote(), local()),
};
if (!commands[cmd]) {
  console.error("Usage: pnpm content <check|seed|pull> [slug] [--store supabase] [--force]");
  process.exit(1);
}
commands[cmd]().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
