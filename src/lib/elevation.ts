import type { Track } from "./schemas";
import { trackLine } from "./track";

/** One sample of a hike's elevation profile: trail mileage and elevation in feet. */
export type ProfilePoint = [mile: number, ft: number];

const FT_PER_M = 3.28084;
/** More samples than this add bytes to every guide page without changing the drawn line. */
const MAX_POINTS = 500;

/**
 * Elevation along the recorded track, for `<ElevationProfile />`. Mileages come from `trackLine`,
 * so they agree with the pins' mileages and end at the hike's distance. A long recording is
 * thinned by keeping the lowest and highest sample of each stretch, so summits and saddles survive.
 */
export function elevationProfile(track: Pick<Track, "points" | "distanceMi"> | null | undefined, maxPoints = MAX_POINTS): ProfilePoint[] | null {
  if (!track || track.points.length < 2) return null;
  const { miles } = trackLine(track);
  const all = track.points.map(([, , ele], i): ProfilePoint => [round(miles[i], 3), Math.round(ele * FT_PER_M)]);
  if (all.length <= maxPoints) return all;

  const inner = all.slice(1, -1);
  const buckets = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const size = inner.length / buckets;
  const kept: ProfilePoint[] = [all[0]];
  for (let b = 0; b < buckets; b++) {
    const chunk = inner.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!chunk.length) continue;
    let lo = chunk[0];
    let hi = chunk[0];
    for (const p of chunk) {
      if (p[1] < lo[1]) lo = p;
      if (p[1] > hi[1]) hi = p;
    }
    kept.push(...(lo === hi ? [lo] : lo[0] < hi[0] ? [lo, hi] : [hi, lo]));
  }
  kept.push(all.at(-1)!);
  return kept;
}

/** Elevation at a trail mileage, between the two samples around it. Clamped to the profile's ends. */
export function elevationAt(profile: ProfilePoint[], mile: number): number {
  if (mile <= profile[0][0]) return profile[0][1];
  const last = profile.at(-1)!;
  if (mile >= last[0]) return last[1];
  // First sample past `mile` (binary search: this runs on every pointer move).
  let lo = 0;
  let hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid][0] <= mile) lo = mid;
    else hi = mid;
  }
  const [m0, f0] = profile[lo];
  const [m1, f1] = profile[hi];
  return m1 === m0 ? f1 : f0 + ((f1 - f0) * (mile - m0)) / (m1 - m0);
}

/** Lowest and highest samples, and the mileage of the highest. */
export function profileExtent(profile: ProfilePoint[]): { minFt: number; maxFt: number; maxAtMi: number; totalMi: number } {
  let min = profile[0];
  let max = profile[0];
  for (const p of profile) {
    if (p[1] < min[1]) min = p;
    if (p[1] > max[1]) max = p;
  }
  return { minFt: min[1], maxFt: max[1], maxAtMi: max[0], totalMi: profile.at(-1)![0] };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
