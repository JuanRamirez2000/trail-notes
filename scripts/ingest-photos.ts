/**
 * Turns a folder of hike photos into a draft waypoints file + web-ready images.
 *
 *   pnpm ingest <photo-folder> --slug <hike-slug> [--storage local|supabase] [--guides local|postgres] [--force] [--dry-run]
 *
 * 1. Reads GPS, capture time and compass heading from EXIF (exifr).
 * 2. Sorts by capture time (used for ordering only, never stored) and fills missing headings:
 *      EXIF heading → bearing to the next photo ("inferred") → null (set by hand).
 * 3. Writes 2 webp variants per photo with ALL metadata stripped (originals never leave your machine).
 * 4. Uploads to /public/photos or Supabase Storage.
 * 5. Writes the pins through the content store (files in content/hikes by default, the database
 *    with --guides postgres), plus a stub guide for new hikes. The store validates the result
 *    and refuses it if the hike was saved by someone else in the meantime.
 *
 * If the hike already has waypoints, the new photos are merged in rather than replacing them:
 * existing pins keep their ids and text, photos ingested before are skipped, and with a recorded
 * track (track.json) new photos are snapped onto it and slotted in by trail mileage.
 * --force replaces waypoints.json instead.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import exifr from "exifr";
import sharp from "sharp";
import { cumulativeMiles } from "../src/lib/geo";
import {
  EXIF_OPTIONS,
  existingNumbering,
  inferHeadings,
  kebab,
  mergeWaypoints,
  PHOTO_SIZES,
  photoKey,
  pinsFromPhotos,
  readPhotoMeta,
  SNAP_MAX_MI,
  sortByCapture,
  WEBP_QUALITY,
  type ScannedPhoto,
} from "../src/lib/ingest";
import { formatIssues, RESERVED_SLUGS, SLUG, waypointsFileSchema, type Waypoint } from "../src/lib/schemas";
import { photoObjectPath, type PhotoVariant } from "../src/lib/storage";
import { validateHike } from "../src/lib/store/validate";
import { mustWrite, scriptStore } from "./lib/stores";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i;

/** A photo with a position (the ones without are skipped), and where its file is. */
type Scanned = ScannedPhoto & { file: string; lat: number; lng: number };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    slug: { type: "string" },
    storage: { type: "string" },
    guides: { type: "string" },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const dir = positionals[0];
const slug = values.slug ?? "";
const storage = (values.storage ?? process.env.NEXT_PUBLIC_PHOTO_STORAGE ?? "local") as "local" | "supabase";
const dryRun = values["dry-run"];

if (!dir || !SLUG.test(slug) || RESERVED_SLUGS.includes(slug) || !["local", "supabase"].includes(storage)) {
  console.error("Usage: pnpm ingest <photo-folder> --slug <kebab-slug> [--storage local|supabase] [--guides local|postgres] [--force] [--dry-run]");
  process.exit(1);
}

async function scan(file: string): Promise<Scanned | { file: string; skip: string }> {
  const exif = await exifr.parse(file, EXIF_OPTIONS).catch(() => null);
  // sharp reports pre-rotation dimensions; autoOrient gives what the viewer will see.
  const { width = 0, height = 0 } = await sharp(file).rotate().metadata().then((m) => ({
    width: m.autoOrient?.width ?? m.width,
    height: m.autoOrient?.height ?? m.height,
  }));
  const meta = readPhotoMeta(exif, { width, height });
  if (meta.lat === null || meta.lng === null) return { file, skip: "no GPS in EXIF" };
  return { ...meta, lat: meta.lat, lng: meta.lng, file, name: path.basename(file), width, height };
}

type Uploader = (objectPath: string, body: Buffer) => Promise<void>;

async function makeUploader(): Promise<Uploader> {
  if (dryRun) return async () => {};
  if (storage === "local") {
    const root = path.join(process.cwd(), "public/photos");
    return async (objectPath, body) => {
      const dest = path.join(root, objectPath);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, body);
    };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "hikes";
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: existing } = await supabase.storage.getBucket(bucket);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(bucket, { public: true, allowedMimeTypes: ["image/webp"] });
    if (error) throw error;
    console.log(`Created public bucket "${bucket}"`);
  }
  return async (objectPath, body) => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, body, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`${objectPath}: ${error.message}`);
  };
}

async function renderVariant(file: string, pano: boolean, variant: PhotoVariant) {
  const max = PHOTO_SIZES[variant][pano ? "pano" : "flat"];
  // sharp drops EXIF/XMP/GPS unless .withMetadata() is called — that's the privacy guarantee.
  return sharp(file)
    .rotate()
    .resize(pano ? { width: max, withoutEnlargement: true } : { width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY[variant] })
    .toBuffer();
}

function mdxStub(first: Waypoint, miles: number, date: string) {
  return `---
title: TODO hike title
slug: ${slug}
region: TODO region
summary: TODO one-line summary.
distanceMi: ${Math.max(miles, 0.1).toFixed(1)}
elevationGainFt: 0
difficulty: moderate
estTime: TODO
cover: ${first.photo?.key ?? `${slug}/cover`}
trailhead:
  lat: ${first.lat}
  lng: ${first.lng}
date: ${date}
---

TODO intro.

<RouteMap />

## The route

{/* Every trailhead/turn/note/bail-out pin gets a section automatically. Write one yourself with
<Step waypoint="wp-02">…</Step> to add your own notes; viewpoints and water only appear if you do. */}

## Water and bail-outs

<SafetyPins />
`;
}

async function main() {
  const files = (await readdir(dir)).filter((f) => IMAGE_EXT.test(f)).map((f) => path.join(dir, f));
  if (!files.length) throw new Error(`No images found in ${dir}`);

  const results = await Promise.all(files.map(scan));
  const skipped = results.filter((r): r is { file: string; skip: string } => "skip" in r);
  const photos = sortByCapture(results.filter((r): r is Scanned => !("skip" in r)));
  if (!photos.length) throw new Error("None of the photos have GPS data.");

  const store = await scriptStore(values.guides);
  const record = await store.read(slug);
  let existing: Waypoint[] | null = null;
  if (record && !values.force) {
    const parsed = waypointsFileSchema.safeParse(JSON.parse(record.waypoints));
    if (!parsed.success) throw new Error(`The hike's stored pins are invalid; fix them in the editor first:\n${formatIssues(parsed.error).join("\n")}`);
    existing = parsed.data.waypoints;
    // Photos are uploaded before the pins are saved, so find out now whether the save can go
    // through: a guide that's already invalid would be refused after the uploads.
    const stored = await validateHike(slug, record.mdx, record.waypoints);
    if (!stored.ok) throw new Error(`The stored guide "${slug}" doesn't pass the save gate; fix it in the editor first:\n  ${stored.problems.join("\n  ")}`);
  }
  const track = record?.track ?? null;
  const { next, names } = existingNumbering(existing ?? []);

  // Headings look at the neighbouring photos, so infer them across the whole folder before
  // dropping the ones that were ingested on an earlier run.
  const headings = inferHeadings(photos);
  const fresh = photos.map((p, i) => ({ p, heading: headings[i] })).filter(({ p }) => !names.has(kebab(p.name)));
  const already = photos.length - fresh.length;
  if (!fresh.length) {
    console.log(`Nothing to do: all ${photos.length} photos are already pins of "${slug}".`);
    return;
  }

  const upload = await makeUploader();
  const stored = [];
  for (const [i, { p, heading }] of fresh.entries()) {
    const key = photoKey(slug, next + i, p.name);
    const full = await renderVariant(p.file, p.isPano, "full");
    const dims = await sharp(full).metadata();
    await upload(photoObjectPath(key, "full"), full);
    await upload(photoObjectPath(key, "thumb"), await renderVariant(p.file, p.isPano, "thumb"));
    stored.push({ key, lat: p.lat, lng: p.lng, ...heading, isPano: p.isPano, width: dims.width, height: dims.height });
    console.log(`  ✓ ${p.name} → ${key}${p.isPano ? " (360°)" : ""}`);
  }
  const incoming = pinsFromPhotos(stored, { isNewHike: !existing?.length, usedIds: existing?.map((w) => w.id) });

  const { waypoints, offTrack } = mergeWaypoints(existing ?? [], incoming, track);
  const file = waypointsFileSchema.safeParse({ waypoints });
  if (!file.success) throw new Error(`Generated waypoints are invalid:\n${formatIssues(file.error).join("\n")}`);

  if (!dryRun) {
    const pins = JSON.stringify({ waypoints }, null, 2) + "\n";
    if (record) {
      mustWrite(await store.save(slug, { mdx: record.mdx, waypoints: pins }, { editor: null, baseVersion: record.version }), `Saving the pins of "${slug}"`);
    } else {
      const miles = cumulativeMiles(waypoints).at(-1) ?? 0;
      const date = new Date(photos[0].takenAt ?? Date.now()).toISOString().slice(0, 10);
      mustWrite(await store.create(slug, { mdx: mdxStub(waypoints[0], miles, date), waypoints: pins }, { editor: null }), `Creating "${slug}"`);
    }
  }

  const inferred = incoming.filter((w) => w.headingSource === "inferred").length;
  const missing = incoming.filter((w) => w.heading === null).length;
  const how = existing?.length ? `merged with ${existing.length} existing` : values.force ? "replaced" : "new";
  console.log(`
${dryRun ? "[dry run] " : ""}${incoming.length} new waypoints (${how}) → "${slug}" in the ${store.kind} store (photos: ${storage})
  headings: ${incoming.length - inferred - missing} from EXIF, ${inferred} inferred from next photo, ${missing} need setting by hand`);
  if (track) console.log(`  snapped onto the recorded track and ordered by trail mileage`);
  if (already) console.log(`  ${already} photo(s) were already ingested and were skipped`);
  const m = (mi: number) => `${Math.round(mi * 1609)} m`;
  if (offTrack.length) {
    console.warn(`  ${offTrack.length} photo(s) kept at their GPS position (more than ${m(SNAP_MAX_MI)} from the track where they fall in time):`);
    for (const o of offTrack) {
      console.warn(
        o.nearestMi <= SNAP_MAX_MI
          ? `    - ${o.id}: ${m(o.nearestMi)} from another part of the track; check its capture time, it may be out of order`
          : `    - ${o.id}: ${m(o.nearestMi)} from the nearest point of the track (side trip?)`,
      );
    }
  }
  if (skipped.length) {
    console.warn(`  skipped ${skipped.length}:`);
    for (const s of skipped) console.warn(`    - ${path.basename(s.file)}: ${s.skip}`);
  }
  if (storage === "local" && !dryRun) {
    console.log("  photos were written to public/photos (dev only, not committed). Run `pnpm photos push` before deploying.");
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
