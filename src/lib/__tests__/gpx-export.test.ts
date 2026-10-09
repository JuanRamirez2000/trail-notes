import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGpx } from "../gpx";
import { toGpx } from "../gpx-export";
import { trackSchema, waypointsFileSchema } from "../schemas";

const dir = "fixtures/hikes/cedar-ridge";
const track = trackSchema.parse(JSON.parse(readFileSync(`${dir}/track.json`, "utf8")));
const { waypoints } = waypointsFileSchema.parse(JSON.parse(readFileSync(`${dir}/waypoints.json`, "utf8")));
const guide = { title: "Cedar Ridge", summary: "Out and back from Cedar Gap.", url: "https://example.test/hikes/cedar-ridge", track, waypoints };

describe("toGpx", () => {
  const gpx = toGpx(guide);

  it("writes every track point and every pin, and no times", () => {
    expect(gpx.match(/<trkpt /g)).toHaveLength(track.points.length);
    expect(gpx.match(/<wpt /g)).toHaveLength(waypoints.length);
    const [lng, lat, ele] = track.points[0];
    expect(gpx).toContain(`<trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`);
    expect(gpx).not.toMatch(/<time>/);
  });

  it("reads back as the same route with the site's own GPX import", () => {
    const back = parseGpx(gpx);
    expect(back).toEqual(track.points);
  });

  it("escapes text, so a title can't break the file", () => {
    const odd = toGpx({ ...guide, title: `Tom & Jerry's <Peak>`, track: null, waypoints: [{ ...waypoints[0], label: `A "quoted" <pin>`, title: "x & y" }] });
    expect(odd).toContain("<name>Tom &amp; Jerry&apos;s &lt;Peak&gt;</name>");
    expect(odd).toContain("<name>A &quot;quoted&quot; &lt;pin&gt;</name><desc>x &amp; y");
    expect(odd).not.toContain("<trk>");
  });
});
