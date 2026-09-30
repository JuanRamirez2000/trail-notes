/**
 * Generates placeholder JPEGs with real EXIF (GPS, capture time, heading) so the ingest
 * pipeline can be exercised end-to-end without real hike photos.
 *
 *   pnpm sample:photos   → fixtures/sample-photos/ridgeline-loop/*.jpg
 *   pnpm ingest fixtures/sample-photos/ridgeline-loop --slug ridgeline-loop
 *
 * Some photos deliberately omit the EXIF heading so the "inferred" path is exercised too.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import turfDestination from "@turf/destination";
import { point } from "@turf/helpers";
// @ts-expect-error — piexifjs ships no types
import piexif from "piexifjs";
import sharp from "sharp";

// Brand palette, duplicated here only because this script renders raster images outside the app.
const C = { paper: "#F4EDE0", chrome: "#E4D8BE", stripe: "#EDE3CB", bark: "#6B4A32", forest: "#2F4A36", ochre: "#D9A441", sky: "#CFDCE3" };

const OUT = path.join(process.cwd(), "fixtures/sample-photos/ridgeline-loop");
const TRAILHEAD = { lat: 47.48, lng: -121.52 };

type Shot = { name: string; label: string; legMi: number; legBearing: number; heading: number | null; pano?: boolean; minute: number };

const SHOTS: Shot[] = [
  { name: "IMG_2041.jpg", label: "Trailhead", legMi: 0, legBearing: 0, heading: 38, minute: 0 },
  { name: "IMG_2047.jpg", label: "Creek junction", legMi: 0.6, legBearing: 40, heading: 330, minute: 14 },
  { name: "IMG_2052.jpg", label: "Spring", legMi: 0.6, legBearing: 60, heading: null, minute: 29 },
  { name: "IMG_2060.jpg", label: "Ridge junction", legMi: 0.6, legBearing: 15, heading: 5, minute: 47 },
  { name: "PANO_2071.jpg", label: "Overlook", legMi: 1.1, legBearing: 70, heading: 70, pano: true, minute: 78 },
  { name: "IMG_2080.jpg", label: "Saddle road exit", legMi: 0.8, legBearing: 95, heading: null, minute: 101 },
];

function flatSvg(label: string, w: number, h: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><pattern id="s" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="16" height="32" fill="${C.chrome}"/><rect x="16" width="16" height="32" fill="${C.stripe}"/></pattern></defs>
  <rect width="100%" height="100%" fill="url(#s)"/>
  <path d="M0 ${h * 0.72} L${w * 0.22} ${h * 0.48} L${w * 0.38} ${h * 0.6} L${w * 0.6} ${h * 0.36} L${w * 0.8} ${h * 0.55} L${w} ${h * 0.45} V${h} H0Z" fill="${C.forest}" opacity=".25"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${w / 16}" fill="${C.forest}">${label}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Menlo, monospace" font-size="${w / 48}" fill="${C.bark}">placeholder photo · Trailnotes sample hike</text>
</svg>`;
}

/** Equirectangular 2:1 pano whose centre column faces `heading`, with compass letters at true bearings. */
function panoSvg(heading: number, w: number, h: number) {
  const xFor = (b: number) => ((((b - heading + 180) % 360) + 360) % 360) / 360 * w;
  const ridge = Array.from({ length: 49 }, (_, i) => {
    const x = (i / 48) * w;
    const y = h * (0.5 - 0.06 * Math.sin(i * 0.9) - 0.04 * Math.sin(i * 2.3 + 1));
    return `${x.toFixed(0)},${y.toFixed(0)}`;
  }).join(" ");
  const letters = [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SW", 225], ["W", 270], ["NW", 315]] as const;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9DB7C6"/><stop offset="1" stop-color="${C.sky}"/></linearGradient></defs>
  <rect width="100%" height="50%" fill="url(#sky)"/>
  <rect y="50%" width="100%" height="50%" fill="${C.paper}"/>
  <polygon points="0,${h * 0.5} ${ridge} ${w},${h * 0.5} ${w},${h * 0.62} 0,${h * 0.62}" fill="${C.forest}" opacity=".55"/>
  <rect y="${h * 0.62}" width="100%" height="${h * 0.38}" fill="${C.chrome}"/>
  ${letters
    .map(
      ([t, b]) => `<text x="${xFor(b)}" y="${h * 0.36}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${h / 12}" fill="${C.forest}">${t}</text>
  <line x1="${xFor(b)}" y1="${h * 0.38}" x2="${xFor(b)}" y2="${h * 0.46}" stroke="${C.ochre}" stroke-width="6"/>`,
    )
    .join("\n  ")}
  <text x="50%" y="${h * 0.8}" text-anchor="middle" font-family="Menlo, monospace" font-size="${h / 40}" fill="${C.bark}">placeholder 360° · Overlook · image centre faces ${heading}°</text>
</svg>`;
}

function exifBytes(lat: number, lng: number, takenAt: Date, heading: number | null) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${takenAt.getUTCFullYear()}:${pad(takenAt.getUTCMonth() + 1)}:${pad(takenAt.getUTCDate())} ${pad(takenAt.getUTCHours())}:${pad(takenAt.getUTCMinutes())}:00`;
  const gps: Record<number, unknown> = {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? "N" : "S",
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? "E" : "W",
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lng)),
  };
  if (heading !== null) {
    gps[piexif.GPSIFD.GPSImgDirectionRef] = "T";
    gps[piexif.GPSIFD.GPSImgDirection] = [Math.round(heading * 100), 100];
  }
  return piexif.dump({ "0th": {}, Exif: { [piexif.ExifIFD.DateTimeOriginal]: stamp }, GPS: gps });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const start = new Date("2026-08-14T15:05:00Z");
  let here = point([TRAILHEAD.lng, TRAILHEAD.lat]);

  for (const s of SHOTS) {
    if (s.legMi > 0) here = turfDestination(here, s.legMi, s.legBearing, { units: "miles" });
    const [lng, lat] = here.geometry.coordinates;
    const [w, h] = s.pano ? [4096, 2048] : [2400, 1600];
    const jpeg = await sharp(Buffer.from(s.pano ? panoSvg(s.heading!, w, h) : flatSvg(s.label, w, h)))
      .jpeg({ quality: 80 })
      .toBuffer();
    const takenAt = new Date(start.getTime() + s.minute * 60_000);
    const withExif = piexif.insert(exifBytes(lat, lng, takenAt, s.heading), jpeg.toString("binary"));
    await writeFile(path.join(OUT, s.name), Buffer.from(withExif, "binary"));
    console.log(`  ✓ ${s.name}  ${lat.toFixed(5)}, ${lng.toFixed(5)}  heading ${s.heading ?? "—"}`);
  }
  console.log(`\nWrote ${SHOTS.length} photos to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
