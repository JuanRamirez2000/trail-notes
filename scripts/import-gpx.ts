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
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import turfSimplify from "@turf/simplify";
import { formatIssues, trackSchema } from "../src/lib/schemas";

const M_TO_FT = 3.28084;
/** Moving-average window for elevation before summing gain; raw GPS altitude is noisy. */
const SMOOTH = 5;

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

function parseGpx(xml: string): [number, number, number][] {
  // GPX is simple enough that a targeted regex beats pulling in an XML parser.
  const out: [number, number, number][] = [];
  const re = /<trkpt\b[^>]*?\blat="([-\d.]+)"[^>]*?\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  for (const m of xml.matchAll(re)) {
    const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
    out.push([Number(m[2]), Number(m[1]), ele ? Number(ele[1]) : NaN]);
  }
  return out;
}

function elevationStats(eles: number[]) {
  const valid = eles.filter((e) => Number.isFinite(e));
  if (!valid.length) return { gainFt: 0, maxFt: 0, minFt: 0 };
  const smooth = valid.map((_, i) => {
    const w = valid.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let gain = 0;
  for (let i = 1; i < smooth.length; i++) gain += Math.max(0, smooth[i] - smooth[i - 1]);
  return { gainFt: gain * M_TO_FT, maxFt: Math.max(...valid) * M_TO_FT, minFt: Math.min(...valid) * M_TO_FT };
}

async function main() {
  const raw = parseGpx(await readFile(file, "utf8"));
  if (raw.length < 2) throw new Error("No track points (<trkpt>) found in the GPX file.");

  const full = lineString(raw.map(([lng, lat]) => [lng, lat]));
  const distanceMi = turfLength(full, { units: "miles" });
  const { gainFt, maxFt, minFt } = elevationStats(raw.map((p) => p[2]));

  // Simplify on [lng, lat, ele]; turf keeps the 3rd coordinate on retained vertices.
  const simplified = turfSimplify(lineString(raw.map(([lng, lat, ele]) => [lng, lat, Number.isFinite(ele) ? ele : 0])), {
    tolerance: Number(values.tolerance),
    highQuality: true,
  });
  const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
  const points = simplified.geometry.coordinates.map(([lng, lat, ele]) => [round(lng, 6), round(lat, 6), round(ele ?? 0, 1)] as [number, number, number]);

  const track = trackSchema.safeParse({
    points,
    distanceMi: round(distanceMi, 2),
    elevationGainFt: Math.round(gainFt),
    maxElevationFt: Math.round(maxFt),
    minElevationFt: Math.round(minFt),
  });
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
