import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatIssues, frontmatterSchema, trackSchema, waypointSchema, waypointsFileSchema } from "../schemas";
import { wp } from "./fixtures";

const FRONTMATTER = {
  title: "Strawberry Peak",
  slug: "strawberry-peak",
  region: "Angeles National Forest",
  summary: "Out-and-back.",
  distanceMi: 7.3,
  elevationGainFt: 1830,
  difficulty: "moderate",
  trailhead: { lat: 34.25, lng: -118.1 },
  date: "2026-04-19",
};

describe("waypointSchema", () => {
  it("fills heading defaults", () => {
    const { heading, headingSource, ...rest } = wp("a", 10);
    void heading;
    void headingSource;
    expect(waypointSchema.parse(rest)).toMatchObject({ heading: null, headingSource: null });
  });

  it.each([
    ["non-kebab id", { id: "Ridge Junction" }],
    ["unknown type", { type: "campsite" }],
    ["heading of 360", { heading: 360 }],
    ["photo key without slug", { photo: { key: "img.webp" } }],
    ["photo key with a path traversal", { photo: { key: "../etc/passwd" } }],
  ])("rejects %s", (_name, patch) => {
    expect(waypointSchema.safeParse({ ...wp("a", 10), ...patch }).success).toBe(false);
  });

  it("defaults photo kind to flat", () => {
    expect(waypointSchema.parse(wp("a", 10, "turn", { photo: { key: "hike/01-a", kind: "flat" } })).photo?.kind).toBe("flat");
    expect(waypointSchema.parse({ ...wp("a", 10), photo: { key: "hike/01-a" } }).photo?.kind).toBe("flat");
  });
});

describe("waypointsFileSchema", () => {
  it("reports duplicate ids at the second occurrence", () => {
    const r = waypointsFileSchema.safeParse({ waypoints: [wp("a", 10), wp("b", 20), wp("a", 30)] });
    expect(r.success).toBe(false);
    expect(formatIssues(r.error!)).toEqual(['waypoints.2.id: duplicate id "a"']);
  });
});

describe("frontmatterSchema", () => {
  it("accepts a hike without a cover", () => {
    expect(frontmatterSchema.parse(FRONTMATTER).cover).toBeUndefined();
  });

  it("drops the retired draft flag (publishing is the guide's status now, not a detail)", () => {
    expect(frontmatterSchema.parse({ ...FRONTMATTER, draft: true })).not.toHaveProperty("draft");
  });

  it("rejects a non-ISO date and an unknown difficulty", () => {
    const r = frontmatterSchema.safeParse({ ...FRONTMATTER, date: "April 19", difficulty: "brutal" });
    expect(formatIssues(r.error!).map((m) => m.split(":")[0]).sort()).toEqual(["date", "difficulty"]);
  });
});

describe("trackSchema", () => {
  it("needs at least two [lng, lat, ele] points", () => {
    const base = { distanceMi: 1, elevationGainFt: 0, maxElevationFt: 0, minElevationFt: 0 };
    expect(trackSchema.safeParse({ ...base, points: [[-118, 34, 100]] }).success).toBe(false);
    expect(trackSchema.safeParse({ ...base, points: [[-118, 34], [-118, 34.1]] }).success).toBe(false);
    expect(trackSchema.safeParse({ ...base, points: [[-118, 34, 100], [-118, 34.1, 120]] }).success).toBe(true);
  });
});

describe("what a pin may carry", () => {
  const pin = { id: "a", order: 10, type: "note", label: "A", title: "A", lat: 34, lng: -118 };

  it("drops a stored capture time when the pin is read (timestamps stay private)", () => {
    const read = waypointsFileSchema.parse({ waypoints: [{ ...pin, takenAt: "2026-04-19T14:14:04.000Z" }] });
    expect(read.waypoints[0]).not.toHaveProperty("takenAt");
    expect(JSON.stringify(read)).not.toContain("2026-04-19");
  });

  it("has no capture times in the guides in content/", () => {
    for (const slug of ["strawberry-peak", "granite-saddle", "ridgeline-loop"]) {
      expect(readFileSync(`content/hikes/${slug}/waypoints.json`, "utf8")).not.toContain("takenAt");
    }
  });
});

describe("trackSchema", () => {
  const track = { distanceMi: 1, elevationGainFt: 0, maxElevationFt: 0, minElevationFt: 0 };
  it("refuses points that aren't on Earth", () => {
    expect(trackSchema.safeParse({ ...track, points: [[-118, 34, 100], [-118, 34.1, 120]] }).success).toBe(true);
    expect(trackSchema.safeParse({ ...track, points: [[999, 999, 1e308], [-118, 34.1, 120]] }).success).toBe(false);
  });
});
