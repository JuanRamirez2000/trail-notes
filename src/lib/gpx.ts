import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import turfSimplify from "@turf/simplify";
import { trackSchema } from "./schemas";

const M_TO_FT = 3.28084;
/** Moving-average window for elevation before summing gain; raw GPS altitude is noisy. */
const SMOOTH = 5;

export type RawPoint = [lng: number, lat: number, ele: number];

export function parseGpx(xml: string): RawPoint[] {
  // GPX is simple enough that a targeted regex beats pulling in an XML parser. Attribute order
  // isn't fixed (some apps write lon first) and a point may be self-closing with no <ele>.
  const out: RawPoint[] = [];
  const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([-\\d.]+)["']`).exec(attrs)?.[1];
  for (const m of xml.matchAll(re)) {
    const lat = attr(m[1], "lat");
    const lon = attr(m[1], "lon");
    if (lat === undefined || lon === undefined) continue;
    const ele = /<ele>\s*([-\d.]+)\s*<\/ele>/.exec(m[2] ?? "");
    out.push([Number(lon), Number(lat), ele ? Number(ele[1]) : NaN]);
  }
  return out;
}

export function elevationStats(eles: number[]) {
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

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Raw recording → track.json shape. Distance and gain come from the full-resolution points;
 * only the stored line is simplified (Douglas-Peucker), so the stats stay accurate.
 */
export function buildTrack(raw: RawPoint[], tolerance = 0.00003) {
  if (raw.length < 2) throw new Error("No track points (<trkpt>) found in the GPX file.");
  const distanceMi = turfLength(lineString(raw.map(([lng, lat]) => [lng, lat])), { units: "miles" });
  const { gainFt, maxFt, minFt } = elevationStats(raw.map((p) => p[2]));

  // Simplify on [lng, lat, ele]; turf keeps the 3rd coordinate on retained vertices.
  const simplified = turfSimplify(lineString(raw.map(([lng, lat, ele]) => [lng, lat, Number.isFinite(ele) ? ele : 0])), {
    tolerance,
    highQuality: true,
  });
  const points = simplified.geometry.coordinates.map(([lng, lat, ele]) => [round(lng, 6), round(lat, 6), round(ele ?? 0, 1)] as RawPoint);

  return trackSchema.safeParse({
    points,
    distanceMi: round(distanceMi, 2),
    elevationGainFt: Math.round(gainFt),
    maxElevationFt: Math.round(maxFt),
    minElevationFt: Math.round(minFt),
  });
}
