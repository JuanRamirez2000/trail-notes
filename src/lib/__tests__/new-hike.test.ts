import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTrack, parseGpx } from "../gpx";
import { buildNewHike, slugify, type NewHikeForm } from "../new-hike";
import type { Track } from "../schemas";
import { validateHike } from "../store/validate";

const FORM: NewHikeForm = { title: "Mount Lawlor: the east ridge", slug: "mount-lawlor", region: "Angeles National Forest", summary: 'A short, steep climb with "big" views.', difficulty: "moderate", date: "2026-10-05" };
const TRACK = JSON.parse(readFileSync("content/hikes/strawberry-peak/track.json", "utf8")) as Track;

describe("slugify", () => {
  it.each([
    ["Strawberry Peak (via Red Box)", "strawberry-peak-via-red-box"],
    ["  Cañón del Río — Loop  ", "canon-del-rio-loop"],
    ["!!!", ""],
  ])("%s → %s", (title, slug) => expect(slugify(title)).toBe(slug));
});

describe("buildNewHike", () => {
  it("makes a draft that passes the save gate, with the route's stats and a trailhead pin", async () => {
    const hike = buildNewHike(FORM, TRACK);
    const v = await validateHike(hike.slug, hike.mdx, hike.waypoints);
    expect(v.ok ? [] : v.problems).toEqual([]);
    expect(v.ok && v.details).toMatchObject({
      title: "Mount Lawlor: the east ridge",
      summary: 'A short, steep climb with "big" views.',
      distanceMi: 7.3,
      elevationGainFt: 1830,
      draft: true,
      trailhead: { lat: TRACK.points[0][1], lng: TRACK.points[0][0] },
    });
    expect(JSON.parse(hike.waypoints).waypoints).toMatchObject([{ id: "trailhead", type: "start", lat: 34.259122, lng: -118.104093 }]);
    expect(hike.mdx).toContain("<RouteMap />");
  });

  it("works without a track, from the numbers typed in", async () => {
    const hike = buildNewHike({ ...FORM, distanceMi: 4.2, elevationGainFt: 900, trailhead: { lat: 34.25, lng: -118.1 } }, null);
    const v = await validateHike(hike.slug, hike.mdx, hike.waypoints);
    expect(v.ok && v.details).toMatchObject({ distanceMi: 4.2, elevationGainFt: 900 });
  });

  it("is refused by the gate when required numbers are missing (no track, nothing typed)", async () => {
    const hike = buildNewHike(FORM, null);
    const v = await validateHike(hike.slug, hike.mdx, hike.waypoints);
    expect(v.ok).toBe(false);
    expect(!v.ok && v.problems.join("\n")).toMatch(/distanceMi|trailhead/);
  });

  it("goes from a GPX file to a valid hike without keeping timestamps", async () => {
    const gpx = `<gpx><trk><trkseg>${Array.from({ length: 40 }, (_, i) => `<trkpt lat="${34 + i / 2000}" lon="-118"><ele>${1000 + i * 5}</ele><time>2026-10-05T15:${String(i).padStart(2, "0")}:00Z</time></trkpt>`).join("")}</trkseg></trk></gpx>`;
    const track = buildTrack(parseGpx(gpx));
    expect(track.success).toBe(true);
    expect(JSON.stringify(track.data)).not.toMatch(/2026|time/);
    const hike = buildNewHike(FORM, track.data!);
    expect((await validateHike(hike.slug, hike.mdx, hike.waypoints)).ok).toBe(true);
  });
});
