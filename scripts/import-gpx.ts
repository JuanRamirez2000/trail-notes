/**
 * Imports a recorded route (GPX) as a hike's track, through the content store (files in
 * content/hikes by default, the database with --guides postgres). For a slug that doesn't exist
 * yet it creates a draft hike with the route's stats filled in.
 *
 *   pnpm gpx <file.gpx> --slug <hike-slug> [--tolerance 0.00003] [--guides local|postgres]
 *
 * Privacy: only lat/lng/elevation are kept. Timestamps, heart rate, cadence, temperature and
 * device metadata are dropped, so the track is safe to publish.
 *
 * The line is simplified (Douglas-Peucker) to keep the page light; distance and elevation gain
 * are computed from the full-resolution recording first, so the stats stay accurate.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { formatIssues, RESERVED_SLUGS, SLUG } from "../src/lib/schemas";
import { buildTrack, parseGpx } from "../src/lib/gpx";
import { mustWrite, scriptStore } from "./lib/stores";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { slug: { type: "string" }, tolerance: { type: "string", default: "0.00003" }, guides: { type: "string" } },
});
const file = positionals[0];
const slug = values.slug ?? "";
if (!file || !SLUG.test(slug) || RESERVED_SLUGS.includes(slug)) {
  console.error("Usage: pnpm gpx <file.gpx> --slug <kebab-slug> [--tolerance 0.00003] [--guides local|postgres]");
  process.exit(1);
}

async function main() {
  const raw = parseGpx(await readFile(file, "utf8"));
  const track = buildTrack(raw, Number(values.tolerance));
  if (!track.success) throw new Error(formatIssues(track.error).join("\n"));

  const t = track.data;
  const store = await scriptStore(values.guides);
  const record = await store.read(slug);
  if (record) {
    mustWrite(await store.setTrack(slug, t, { editor: null, baseVersion: record.version }), `Setting the track of "${slug}"`);
  } else {
    const [lng, lat] = t.points[0];
    const mdx = `---
title: TODO hike title
slug: ${slug}
region: TODO region
summary: TODO one-line summary.
distanceMi: ${t.distanceMi}
elevationGainFt: ${t.elevationGainFt}
difficulty: moderate
trailhead:
  lat: ${lat}
  lng: ${lng}
date: ${new Date().toISOString().slice(0, 10)}
---

TODO intro.

<RouteMap />
`;
    mustWrite(await store.create(slug, { mdx, waypoints: '{\n  "waypoints": []\n}\n', track: t }, { editor: null }), `Creating "${slug}"`);
  }

  console.log(`✓ ${raw.length} points → ${t.points.length} (simplified) → track of "${slug}" in the ${store.kind} store${record ? "" : " (new draft hike)"}
  distance ${t.distanceMi} mi · gain ${t.elevationGainFt} ft · elevation ${t.minElevationFt}–${t.maxElevationFt} ft
  start ${t.points[0][1]}, ${t.points[0][0]}${record ? "  (check the trailhead in the guide's details)" : ""}`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
