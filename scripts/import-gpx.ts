/**
 * Imports a recorded route (GPX) as content/hikes/<slug>/track.json.
 *
 *   pnpm gpx <file.gpx> --slug <hike-slug> [--tolerance 0.00003]
 *
 * Privacy: only lat/lng/elevation are kept. Timestamps, heart rate, cadence, temperature and
 * device metadata are dropped, so the track is safe to publish.
 *
 * The line is simplified (Douglas-Peucker) to keep the page light; distance and elevation gain
 * are computed from the full-resolution recording first, so the stats stay accurate.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatIssues } from "../src/lib/schemas";
import { buildTrack, parseGpx } from "./lib/gpx";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { slug: { type: "string" }, tolerance: { type: "string", default: "0.00003" } },
});
const file = positionals[0];
const slug = values.slug ?? "";
if (!file || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Usage: pnpm gpx <file.gpx> --slug <kebab-slug> [--tolerance 0.00003]");
  process.exit(1);
}

async function main() {
  const raw = parseGpx(await readFile(file, "utf8"));
  const track = buildTrack(raw, Number(values.tolerance));
  if (!track.success) throw new Error(formatIssues(track.error).join("\n"));

  const dir = path.join(process.cwd(), "content/hikes", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "track.json"), JSON.stringify(track.data) + "\n");

  const t = track.data;
  console.log(`✓ ${raw.length} points → ${t.points.length} (simplified) → content/hikes/${slug}/track.json
  distance ${t.distanceMi} mi · gain ${t.elevationGainFt} ft · elevation ${t.minElevationFt}–${t.maxElevationFt} ft
  start ${t.points[0][1]}, ${t.points[0][0]}  (use as trailhead in index.mdx)`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
