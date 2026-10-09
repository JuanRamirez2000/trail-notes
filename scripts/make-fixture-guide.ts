/**
 * Writes the test fixture guide, Cedar Ridge: fixtures/hikes/cedar-ridge (guide, pins, track and a
 * published copy) and fixtures/photos/cedar-ridge (placeholder photos in both stored sizes).
 *
 *   pnpm exec tsx scripts/make-fixture-guide.ts
 *
 * Everything in it is invented, so no real guide or photo has to live in the repo: the tests and
 * the end-to-end suite run on this. Its shape is what they rely on: a published out-and-back with
 * a recorded track, six pins with a photo each, and a cover photo that is on no pin.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildTrack, type RawPoint } from "../src/lib/gpx";

const root = path.join(process.cwd(), "fixtures");
const SLUG = "cedar-ridge";
// An invented out-and-back: 3.65 mi each way from a made-up trailhead.
const N = 420, ONE_WAY_MI = 3.65, LAT0 = 44.3, LNG0 = -121.8;
const MI_LAT = 1 / 69.05, MI_LNG = 1 / (69.17 * Math.cos((LAT0 * Math.PI) / 180));
const eleAt = (mi: number) => {
  // metres: steady first mile, a long level stretch, a dip to a saddle, then a steep finish
  if (mi <= 1) return 1420 + 100 * mi;
  if (mi <= 2.2) return 1520 + 45 * ((mi - 1) / 1.2);
  if (mi <= 2.4) return 1565 - 18 * ((mi - 2.2) / 0.2);
  return 1547 + 262 * Math.pow((mi - 2.4) / (ONE_WAY_MI - 2.4), 1.15);
};
const out: RawPoint[] = [];
let lat = LAT0, lng = LNG0;
for (let i = 0; i <= N; i++) {
  const mi = (i / N) * ONE_WAY_MI;
  out.push([+lng.toFixed(6), +lat.toFixed(6), +eleAt(mi).toFixed(1)]);
  // heading swings between north-west and north-east, tighter near the top
  const bearing = ((-25 + 55 * Math.sin(mi * 1.7) + (mi > 2.4 ? 30 * Math.sin(mi * 9) : 0)) * Math.PI) / 180;
  const step = ONE_WAY_MI / N;
  lat += Math.cos(bearing) * step * MI_LAT;
  lng += Math.sin(bearing) * step * MI_LNG;
}
const raw = [...out, ...out.slice(0, -1).reverse()];
const track = buildTrack(raw);
if (!track.success) throw track.error;
const at = (mi: number) => out[Math.round((mi / ONE_WAY_MI) * N)];

const pins = [
  ["trailhead", "start", "Cedar Gap", "Start at the Cedar Gap pullout", "The route starts at a gravel pullout at about 4,660 ft. The first mile climbs steadily.", 0, 20, "01-img-8950"],
  ["mountain-curve", "note", "Mountain curve", "The climb eases and the trail wraps around the slope", "After the first mile the grade eases, and the trail stays nearly level as it rounds the hillside.", 1.1, 310, "02-img-8956"],
  ["saddle", "note", "Saddle", "Cross the saddle", "The low point between the level stretch and the final climb, 2.4 mi in. A natural place for a break.", 2.4, 350, "07-img-8957"],
  ["rocky-climb", "note", "Rocky climb", "The rocky climb begins", "From here to the top the trail is steep and rocky. Budget as long for this part as for everything before it.", 2.8, 15, "04-img-8959"],
  ["steepest-pitch", "note", "Steepest pitch", "Steepest pitch: loose rock underfoot", "The steepest part of the route. Slow and careful, especially on the way down.", 3.4, 40, "05-img-8962"],
  ["high-point", "note", "Summit", "Reach the summit and turn around", "The high point of the route. The way back is the way you came.", 3.65, 180, "06-img-8968"],
] as const;
const waypoints = pins.map(([id, type, label, title, caption, mi, heading, photo], i) => {
  const [lng, lat] = at(mi);
  return { id, order: (i + 1) * 10, type, label, title, caption, lat, lng, heading, headingSource: "exif", photo: { key: `${SLUG}/${photo}`, kind: "flat", width: 1800, height: 2400 } };
});

const mdx = `---
title: Cedar Ridge
slug: ${SLUG}
region: Fixture Range
summary: A made-up out-and-back from Cedar Gap that ends with a steep, rocky climb to a summit. It exists for the tests.
distanceMi: 7.3
elevationGainFt: ${track.data.elevationGainFt}
difficulty: hard
estTime: about 4 h
bestSeason: spring
cover: ${SLUG}/03-img-8958
date: 2026-04-19
trailhead:
  lat: ${waypoints[0].lat}
  lng: ${waypoints[0].lng}
essentials:
  parking: Gravel pullout at Cedar Gap, room for a dozen cars.
  water: None on the route. Carry all you need.
  hazards:
    - Steep, rocky climb for the last 1.2 mi.
    - Loose rock on the steepest pitch. Slow and careful on the way down.
---

*This guide is a fixture: the place, the route and the photos are invented for the tests.*

This out-and-back starts at Cedar Gap and has three distinct parts. A steady first-mile climb gives way to a long, nearly level stretch that wraps around the slope to a saddle. From there, a steep and rocky climb leads to the summit. The return follows the same way: 7.3 miles in all.

Most of the time goes into the last mile: the rocky section is slow going on the way up and on the way down.

<RouteMap />

<ElevationProfile />

## The route

<Step waypoint="trailhead" />

<Step waypoint="mountain-curve" />

<Step waypoint="saddle" />

<Step waypoint="rocky-climb" />

<Step waypoint="steepest-pitch" />

<Step waypoint="high-point" />
`;
const dir = path.join(root, "hikes", SLUG);
await mkdir(path.join(dir, "published"), { recursive: true });
const wpText = JSON.stringify({ waypoints }, null, 2) + "\n";
await writeFile(path.join(dir, "index.mdx"), mdx);
await writeFile(path.join(dir, "waypoints.json"), wpText);
await writeFile(path.join(dir, "track.json"), JSON.stringify(track.data) + "\n");
await writeFile(path.join(dir, "published/index.mdx"), mdx);
await writeFile(path.join(dir, "published/waypoints.json"), wpText);

// Placeholder photos: a flat picture with the file's name on it, in both stored sizes.
const photoDir = path.join(root, "photos", SLUG);
await mkdir(photoDir, { recursive: true });
const hues = [95, 30, 205, 150, 270, 55, 0];
for (const [i, name] of ["01-img-8950", "02-img-8956", "03-img-8958", "04-img-8959", "05-img-8962", "06-img-8968", "07-img-8957"].entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hues[i]},45%,78%)"/><stop offset="1" stop-color="hsl(${hues[i]},40%,38%)"/></linearGradient></defs><rect width="1800" height="2400" fill="url(#g)"/><path d="M0 1700 L500 1150 L850 1500 L1250 950 L1800 1650 L1800 2400 L0 2400 Z" fill="hsl(${hues[i]},35%,26%)"/><text x="900" y="700" font-family="Georgia, serif" font-size="150" font-weight="700" text-anchor="middle" fill="#1f2421">Fixture photo</text><text x="900" y="880" font-family="monospace" font-size="90" text-anchor="middle" fill="#1f2421">${name}</text></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 70 }).toFile(path.join(photoDir, `${name}.full.webp`));
  await sharp(Buffer.from(svg)).resize(360, 480).webp({ quality: 70 }).toFile(path.join(photoDir, `${name}.thumb.webp`));
}
console.log(track.data.points.length, "points", track.data.distanceMi, "mi", track.data.elevationGainFt, "ft gain", track.data.minElevationFt, "-", track.data.maxElevationFt);
