/**
 * Generates placeholder JPEGs with real EXIF (GPS, capture time, heading) so the ingest
 * pipeline can be exercised end-to-end without real hike photos.
 *
 *   pnpm sample:photos [slug]   → fixtures/sample-photos/<slug>/*.jpg (all samples if no slug)
 *   pnpm ingest fixtures/sample-photos/<slug> --slug <slug>
 *
 * Some photos deliberately omit the EXIF heading so the "inferred" path is exercised too.
 * Pass `pano: true` on a shot to render a 2:1 equirectangular test image for the 360° viewer.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
// @ts-expect-error — piexifjs ships no types
import piexif from "piexifjs";
import sharp from "sharp";

// Brand palette, duplicated here only because this script renders raster images outside the app.
const C = { paper: "#F4EDE0", chrome: "#E4D8BE", stripe: "#EDE3CB", bark: "#6B4A32", forest: "#2F4A36", ochre: "#D9A441", sky: "#CFDCE3" };

type Shot = { name: string; label: string; lat: number; lng: number; heading: number | null; pano?: boolean; minute: number };
type Sample = { start: string; shots: Shot[] };

// Coordinates are fixed (not random) so re-running reproduces the same waypoints.
const SAMPLES: Record<string, Sample> = {
  "ridgeline-loop": {
    start: "2026-08-14T15:05:00Z",
    shots: [
      { name: "IMG_2041.jpg", label: "Trailhead", lat: 47.48, lng: -121.52, heading: 38, minute: 0 },
      { name: "IMG_2047.jpg", label: "Creek junction", lat: 47.486653, lng: -121.511739, heading: 330, minute: 14 },
      { name: "IMG_2052.jpg", label: "Spring", lat: 47.490994, lng: -121.500611, heading: null, minute: 29 },
      { name: "IMG_2060.jpg", label: "Ridge junction", lat: 47.499381, lng: -121.497283, heading: 5, minute: 47 },
      { name: "IMG_2071.jpg", label: "Overlook", lat: 47.504825, lng: -121.475136, heading: 70, minute: 78 },
      { name: "IMG_2080.jpg", label: "Saddle road exit", lat: 47.503814, lng: -121.458064, heading: null, minute: 101 },
    ],
  },
  // Lollipop loop: stem to a junction, then clockwise over First Pass and Granite Saddle.
  "granite-saddle": {
    start: "2026-07-18T13:40:00Z",
    shots: [
      { name: "IMG_3101.jpg", label: "Granite Creek trailhead", lat: 47.41, lng: -121.38, heading: 15, minute: 0 },
      { name: "IMG_3103.jpg", label: "Ranger station", lat: 47.411425, lng: -121.380371, heading: 340, minute: 4 },
      { name: "IMG_3110.jpg", label: "Loop junction", lat: 47.42128, lng: -121.370374, heading: 300, minute: 22 },
      { name: "IMG_3116.jpg", label: "Granite Creek ford", lat: 47.428371, lng: -121.377446, heading: null, minute: 38 },
      { name: "IMG_3121.jpg", label: "Miners' cabin", lat: 47.434013, lng: -121.379763, heading: 10, minute: 55 },
      { name: "IMG_3125.jpg", label: "Switchbacks", lat: 47.43909, lng: -121.379963, heading: null, minute: 66 },
      { name: "IMG_3132.jpg", label: "Cedar Range view", lat: 47.444439, lng: -121.378285, heading: 255, minute: 92 },
      { name: "IMG_3135.jpg", label: "Upper Basin trail", lat: 47.447668, lng: -121.376211, heading: 290, minute: 101 },
      { name: "IMG_3141.jpg", label: "First Pass", lat: 47.452148, lng: -121.371576, heading: 40, minute: 120 },
      { name: "IMG_3147.jpg", label: "Tarn Lake", lat: 47.456163, lng: -121.364503, heading: 80, minute: 138 },
      { name: "IMG_3150.jpg", label: "Scree traverse", lat: 47.45822, lng: -121.35827, heading: null, minute: 152 },
      { name: "IMG_3158.jpg", label: "Granite Saddle", lat: 47.459488, lng: -121.349814, heading: 95, minute: 171 },
      { name: "IMG_3163.jpg", label: "Saddle junction", lat: 47.459355, lng: -121.342304, heading: 110, minute: 190 },
      { name: "IMG_3169.jpg", label: "North snowfield", lat: 47.456567, lng: -121.330333, heading: 130, minute: 212 },
      { name: "IMG_3174.jpg", label: "Hidden Meadow spring", lat: 47.449024, lng: -121.31879, heading: null, minute: 236 },
      { name: "IMG_3180.jpg", label: "Fire road", lat: 47.43909, lng: -121.313881, heading: 190, minute: 258 },
      { name: "IMG_3186.jpg", label: "Lookout ruins", lat: 47.426605, lng: -121.317644, heading: 250, minute: 284 },
    ],
  },
};

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
  const only = process.argv[2];
  const slugs = only ? [only] : Object.keys(SAMPLES);
  for (const slug of slugs) {
    const sample = SAMPLES[slug];
    if (!sample) throw new Error(`No sample named "${slug}". Options: ${Object.keys(SAMPLES).join(", ")}`);
    const out = path.join(process.cwd(), "fixtures/sample-photos", slug);
    await mkdir(out, { recursive: true });
    const start = new Date(sample.start);
    for (const s of sample.shots) {
      const [w, h] = s.pano ? [4096, 2048] : [2400, 1600];
      const jpeg = await sharp(Buffer.from(s.pano ? panoSvg(s.heading!, w, h) : flatSvg(s.label, w, h)))
        .jpeg({ quality: 80 })
        .toBuffer();
      const takenAt = new Date(start.getTime() + s.minute * 60_000);
      const withExif = piexif.insert(exifBytes(s.lat, s.lng, takenAt, s.heading), jpeg.toString("binary"));
      await writeFile(path.join(out, s.name), Buffer.from(withExif, "binary"));
    }
    console.log(`  ✓ ${slug}: ${sample.shots.length} photos → ${path.relative(process.cwd(), out)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
