/**
 * Turns a folder of hike photos into a draft waypoints file + web-ready images.
 *
 *   pnpm ingest <photo-folder> --slug <hike-slug> [--storage local|supabase] [--force] [--dry-run]
 *
 * 1. Reads GPS, capture time and compass heading from EXIF (exifr).
 * 2. Sorts by capture time and fills missing headings:
 *      EXIF heading → bearing to the next photo ("inferred") → null (set by hand).
 * 3. Writes 2 webp variants per photo with ALL metadata stripped (originals never leave your machine).
 * 4. Uploads to /public/photos or Supabase Storage.
 * 5. Writes content/hikes/<slug>/waypoints.json, or waypoints.draft.json if one already exists
 *    (so hand edits are never clobbered), plus an index.mdx stub for new hikes.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import exifr from "exifr";
import sharp from "sharp";
import { bearing, cumulativeMiles, distanceMi } from "../src/lib/geo";
import { formatIssues, waypointsFileSchema, type Waypoint } from "../src/lib/schemas";
import { photoObjectPath, type PhotoVariant } from "../src/lib/storage";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i;
const SIZES: Record<PhotoVariant, { flat: number; pano: number }> = {
  full: { flat: 2400, pano: 6144 },
  thumb: { flat: 480, pano: 960 },
};
/** Photos closer than this are treated as the same spot when inferring a heading. */
const SAME_SPOT_MI = 0.005; // ~8 m

type Scanned = {
  file: string;
  lat: number;
  lng: number;
  takenAt?: Date;
  heading: number | null;
  pano: boolean;
  width: number;
  height: number;
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    slug: { type: "string" },
    storage: { type: "string" },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const dir = positionals[0];
const slug = values.slug ?? "";
const storage = (values.storage ?? process.env.NEXT_PUBLIC_PHOTO_STORAGE ?? "local") as "local" | "supabase";
const dryRun = values["dry-run"];

if (!dir || !slug || !/^[a-z0-9-]+$/.test(slug) || !["local", "supabase"].includes(storage)) {
  console.error("Usage: pnpm ingest <photo-folder> --slug <kebab-slug> [--storage local|supabase] [--force] [--dry-run]");
  process.exit(1);
}

const round = (n: number, dp = 6) => Math.round(n * 10 ** dp) / 10 ** dp;
const kebab = (s: string) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function scan(file: string): Promise<Scanned | { file: string; skip: string }> {
  const meta = await exifr.parse(file, { gps: true, xmp: true, tiff: true, exif: true }).catch(() => null);
  if (!meta || typeof meta.latitude !== "number" || typeof meta.longitude !== "number") {
    return { file, skip: "no GPS in EXIF" };
  }
  // sharp reports pre-rotation dimensions; autoOrient gives what the viewer will see.
  const { width = 0, height = 0 } = await sharp(file).rotate().metadata().then((m) => ({
    width: m.autoOrient?.width ?? m.width,
    height: m.autoOrient?.height ?? m.height,
  }));
  const pano = meta.ProjectionType === "equirectangular" || (width > 0 && Math.abs(width / height - 2) < 0.02);
  // Panos (GPano XMP) store the image-centre heading as PoseHeadingDegrees.
  const rawHeading = pano ? (meta.PoseHeadingDegrees ?? meta.GPSImgDirection) : meta.GPSImgDirection;
  const takenAt: Date | undefined = meta.DateTimeOriginal ?? meta.CreateDate ?? undefined;
  return {
    file,
    lat: meta.latitude,
    lng: meta.longitude,
    takenAt: takenAt instanceof Date && !Number.isNaN(+takenAt) ? takenAt : undefined,
    heading: typeof rawHeading === "number" ? ((rawHeading % 360) + 360) % 360 : null,
    pano,
    width,
    height,
  };
}

function inferHeadings(photos: Scanned[]) {
  return photos.map((p, i) => {
    if (p.heading !== null) return { heading: round(p.heading, 1), source: "exif" as const };
    const next = photos.slice(i + 1).find((q) => distanceMi(p, q) > SAME_SPOT_MI);
    if (next) return { heading: round(bearing(p, next), 1), source: "inferred" as const };
    return { heading: null, source: null };
  });
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
  const max = SIZES[variant][pano ? "pano" : "flat"];
  // sharp drops EXIF/XMP/GPS unless .withMetadata() is called — that's the privacy guarantee.
  return sharp(file)
    .rotate()
    .resize(pano ? { width: max, withoutEnlargement: true } : { width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: variant === "full" ? 82 : 74 })
    .toBuffer();
}

function mdxStub(first: Waypoint, miles: number, date: string) {
  return `---
title: TODO hike title
slug: ${slug}
region: TODO region
summary: TODO one-line summary.
distanceMi: ${miles.toFixed(1)}
elevationGainFt: 0
difficulty: moderate
estTime: TODO
cover: ${first.photo?.key ?? `${slug}/cover`}
trailhead:
  lat: ${first.lat}
  lng: ${first.lng}
date: ${date}
draft: true
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
  const photos = results
    .filter((r): r is Scanned => !("skip" in r))
    .sort((a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0) || a.file.localeCompare(b.file));
  if (!photos.length) throw new Error("None of the photos have GPS data.");

  const headings = inferHeadings(photos);
  const upload = await makeUploader();
  const waypoints: Waypoint[] = [];

  for (const [i, p] of photos.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const photoKey = `${slug}/${n}-${kebab(path.basename(p.file))}`;
    const full = await renderVariant(p.file, p.pano, "full");
    const dims = await sharp(full).metadata();
    await upload(photoObjectPath(photoKey, "full"), full);
    await upload(photoObjectPath(photoKey, "thumb"), await renderVariant(p.file, p.pano, "thumb"));
    waypoints.push({
      id: `wp-${n}`,
      order: (i + 1) * 10, // gaps leave room to insert waypoints by hand
      type: i === 0 ? "start" : "turn",
      label: i === 0 ? "Trailhead" : `Waypoint ${i + 1}`,
      title: "TODO describe this step",
      lat: round(p.lat),
      lng: round(p.lng),
      heading: headings[i].heading,
      headingSource: headings[i].source,
      photo: {
        key: photoKey,
        kind: p.pano ? "pano" : "flat",
        width: dims.width,
        height: dims.height,
      },
      takenAt: p.takenAt?.toISOString(),
    });
    console.log(`  ✓ ${path.basename(p.file)} → ${photoKey}${p.pano ? " (360°)" : ""}`);
  }

  const file = waypointsFileSchema.safeParse({ waypoints });
  if (!file.success) throw new Error(`Generated waypoints are invalid:\n${formatIssues(file.error).join("\n")}`);

  const hikeDir = path.join(process.cwd(), "content/hikes", slug);
  const target = existsSync(path.join(hikeDir, "waypoints.json")) && !values.force ? "waypoints.draft.json" : "waypoints.json";
  if (!dryRun) {
    await mkdir(hikeDir, { recursive: true });
    await writeFile(path.join(hikeDir, target), JSON.stringify(file.data, null, 2) + "\n");
    if (!existsSync(path.join(hikeDir, "index.mdx"))) {
      const miles = cumulativeMiles(waypoints).at(-1) ?? 0;
      const date = (photos[0].takenAt ?? new Date()).toISOString().slice(0, 10);
      await writeFile(path.join(hikeDir, "index.mdx"), mdxStub(waypoints[0], miles, date));
    }
  }

  const inferred = waypoints.filter((w) => w.headingSource === "inferred").length;
  const missing = waypoints.filter((w) => w.heading === null).length;
  console.log(`
${dryRun ? "[dry run] " : ""}${waypoints.length} waypoints → content/hikes/${slug}/${target} (photos: ${storage})
  headings: ${waypoints.length - inferred - missing} from EXIF, ${inferred} inferred from next photo, ${missing} need setting by hand`);
  if (skipped.length) {
    console.warn(`  skipped ${skipped.length}:`);
    for (const s of skipped) console.warn(`    - ${path.basename(s.file)}: ${s.skip}`);
  }
  if (target === "waypoints.draft.json") {
    console.log("  waypoints.json already existed, so the new draft was written alongside it. Merge by hand or re-run with --force.");
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
