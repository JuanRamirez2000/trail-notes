import { stringify } from "yaml";
import { joinGuide } from "./frontmatter";
import type { Difficulty, Track } from "./schemas";

/**
 * A new hike as the editor's "New hike" form creates it: a draft guide with a route map and one
 * pin at the trailhead, ready for pins to be added in the Pins view. With a recorded track, the
 * distance, climbing and trailhead come from the track.
 */
export type NewHikeForm = {
  title: string;
  slug: string;
  region: string;
  summary: string;
  difficulty: Difficulty;
  /** YYYY-MM-DD */
  date: string;
  /** Used only without a track. */
  distanceMi?: number;
  elevationGainFt?: number;
  trailhead?: { lat: number; lng: number };
};

/** "Strawberry Peak (via Red Box)" → "strawberry-peak-via-red-box" */
export const slugify = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function buildNewHike(form: NewHikeForm, track: Track | null): { slug: string; mdx: string; waypoints: string } {
  const start = track ? { lat: track.points[0][1], lng: track.points[0][0] } : form.trailhead;
  const details = {
    title: form.title.trim(),
    slug: form.slug,
    region: form.region.trim(),
    summary: form.summary.trim(),
    // A very short recording still needs a distance above zero.
    distanceMi: track ? Math.max(round(track.distanceMi, 1), 0.1) : form.distanceMi,
    elevationGainFt: track ? track.elevationGainFt : form.elevationGainFt,
    difficulty: form.difficulty,
    trailhead: start,
    date: form.date,
  };
  // The summary isn't repeated in the body: the page shows it under the title, and as body text
  // it would have to be valid MDX (a `{` or `<` in it would refuse the whole hike).
  const body = "<RouteMap />\n\n## The route\n";
  const pins = start
    ? [
        {
          id: "trailhead",
          order: 10,
          type: "start",
          label: "Trailhead",
          title: "Start at the trailhead",
          lat: round(start.lat, 6),
          lng: round(start.lng, 6),
          heading: null,
          headingSource: null,
        },
      ]
    : [];
  return {
    slug: form.slug,
    mdx: joinGuide({ yaml: stringify(details, { lineWidth: 0 }), body }),
    waypoints: `${JSON.stringify({ waypoints: pins }, null, 2)}\n`,
  };
}
