import type { Track, Waypoint } from "./schemas";

/**
 * A guide as a GPX file, for a phone's map app or a GPS watch: the recorded track as one
 * `<trk>`, and every pin as a `<wpt>`. Like everything the site publishes, it has no times in it
 * (the track is stored without them), so it can't give away pace.
 */
export type GpxExport = {
  title: string;
  summary?: string;
  /** Absolute address of the guide, written as the file's link. */
  url: string;
  track: Pick<Track, "points"> | null;
  waypoints: Pick<Waypoint, "label" | "title" | "caption" | "note" | "type" | "lat" | "lng">[];
};

const escape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
const tag = (name: string, text: string | undefined) => (text ? `<${name}>${escape(text)}</${name}>` : "");

export function toGpx({ title, summary, url, track, waypoints }: GpxExport): string {
  const wpts = waypoints.map((w) => {
    const desc = [w.title !== w.label ? w.title : "", w.caption, w.note].filter(Boolean).join(" · ");
    return `  <wpt lat="${w.lat}" lon="${w.lng}">${tag("name", w.label)}${tag("desc", desc)}${tag("type", w.type)}</wpt>`;
  });
  // Elevation is stored in metres, which is what GPX expects.
  const trk = track
    ? [`  <trk>`, `    ${tag("name", title)}`, `    <trkseg>`, ...track.points.map(([lng, lat, ele]) => `      <trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`), `    </trkseg>`, `  </trk>`]
    : [];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Trailnotes" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata>${tag("name", title)}${tag("desc", summary)}<link href="${escape(url)}"><text>Trailnotes</text></link></metadata>`,
    ...wpts,
    ...trk,
    `</gpx>`,
    ``,
  ].join("\n");
}

/** Where a guide's GPX file is served. */
export const gpxPath = (slug: string) => `/hikes/${slug}/route.gpx`;
