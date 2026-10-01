/**
 * Keeps Supabase Storage (the source of truth for photos) and the dev-only local copy in sync.
 *
 *   pnpm photos check          every photo the content references exists in the bucket (CI runs this)
 *   pnpm photos push [slug]    upload public/photos/** to the bucket (skips files already there)
 *   pnpm photos pull [slug]    download the bucket into public/photos, for offline `pnpm dev`
 *
 * `check` only needs NEXT_PUBLIC_SUPABASE_URL (it reads public URLs); push/pull also need
 * SUPABASE_SERVICE_ROLE_KEY, so they only ever run on your machine.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { frontmatterSchema, waypointsFileSchema } from "../src/lib/schemas";
import { PHOTO_BUCKET, photoObjectPath, type PhotoVariant } from "../src/lib/storage";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional: CI passes env directly
}

const HIKES = path.join(process.cwd(), "content/hikes");
const LOCAL = path.join(process.cwd(), "public/photos");
const VARIANTS: PhotoVariant[] = ["full", "thumb"];
const [cmd, only] = process.argv.slice(2);

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

async function client() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }).storage.from(
    PHOTO_BUCKET,
  );
}

const slugs = async () =>
  (await readdir(HIKES, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && (!only || d.name === only))
    .map((d) => d.name);

/** Every object path the content refers to: waypoint photos and covers, both variants. */
async function referencedObjects() {
  const keys = new Set<string>();
  for (const slug of await slugs()) {
    const wpFile = path.join(HIKES, slug, "waypoints.json");
    if (existsSync(wpFile)) {
      const { waypoints } = waypointsFileSchema.parse(JSON.parse(await readFile(wpFile, "utf8")));
      for (const w of waypoints) if (w.photo) keys.add(w.photo.key);
    }
    const mdx = await readFile(path.join(HIKES, slug, "index.mdx"), "utf8");
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mdx);
    const cover = fm ? frontmatterSchema.shape.cover.parse(parseYaml(fm[1])?.cover) : undefined;
    if (cover) keys.add(cover);
  }
  return [...keys].flatMap((k) => VARIANTS.map((v) => photoObjectPath(k, v)));
}

async function check() {
  const base = `${env("NEXT_PUBLIC_SUPABASE_URL")}/storage/v1/object/public/${PHOTO_BUCKET}`;
  const objects = await referencedObjects();
  const missing: string[] = [];
  // Small batches: a handful of hikes × a few dozen photos, no need for anything cleverer.
  for (let i = 0; i < objects.length; i += 16) {
    const batch = objects.slice(i, i + 16);
    const res = await Promise.all(batch.map((o) => fetch(`${base}/${o}`, { method: "HEAD" })));
    res.forEach((r, j) => r.ok || missing.push(`${batch[j]} (${r.status})`));
  }
  if (missing.length) {
    throw new Error(`${missing.length} photo(s) missing from the "${PHOTO_BUCKET}" bucket:\n  ${missing.join("\n  ")}\nRun \`pnpm photos push\`.`);
  }
  console.log(`✓ all ${objects.length} referenced photo files are in the "${PHOTO_BUCKET}" bucket`);
}

async function listRemote(bucket: Awaited<ReturnType<typeof client>>, slug: string) {
  const { data, error } = await bucket.list(slug, { limit: 1000 });
  if (error) throw error;
  return new Set(data.filter((f) => f.id).map((f) => `${slug}/${f.name}`));
}

async function push() {
  const bucket = await client();
  let uploaded = 0;
  for (const slug of await slugs()) {
    const dir = path.join(LOCAL, slug);
    if (!existsSync(dir)) continue;
    const remote = await listRemote(bucket, slug);
    for (const name of await readdir(dir)) {
      const object = `${slug}/${name}`;
      if (!name.endsWith(".webp") || remote.has(object)) continue;
      const { error } = await bucket.upload(object, await readFile(path.join(dir, name)), {
        contentType: "image/webp",
        cacheControl: "31536000",
      });
      if (error) throw new Error(`${object}: ${error.message}`);
      uploaded++;
      console.log(`  ↑ ${object}`);
    }
  }
  console.log(`✓ uploaded ${uploaded} file(s)`);
}

async function pull() {
  const bucket = await client();
  let downloaded = 0;
  for (const slug of await slugs()) {
    for (const object of await listRemote(bucket, slug)) {
      const dest = path.join(LOCAL, object);
      if (existsSync(dest)) continue;
      const { data, error } = await bucket.download(object);
      if (error) throw new Error(`${object}: ${error.message}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await data.arrayBuffer()));
      downloaded++;
    }
  }
  console.log(`✓ downloaded ${downloaded} file(s) to public/photos`);
}

const commands: Record<string, () => Promise<void>> = { check, push, pull };
if (!commands[cmd]) {
  console.error("Usage: pnpm photos <check|push|pull> [slug]");
  process.exit(1);
}
commands[cmd]().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
