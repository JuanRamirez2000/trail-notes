import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitGuide } from "@/lib/frontmatter";
import { waypointsFileSchema } from "@/lib/schemas";
import { insertSection, missingSections } from "../write/missing-sections";

const BODY = splitGuide(readFileSync("fixtures/hikes/cedar-ridge/index.mdx", "utf8")).body;
const PINS = waypointsFileSchema.parse(JSON.parse(readFileSync("fixtures/hikes/cedar-ridge/waypoints.json", "utf8"))).waypoints;
const ids = (body: string) => missingSections(body, PINS).map((s) => s.waypoint.id);
const steps = (body: string) => [...body.matchAll(/<Step waypoint="([^"]+)"/g)].map((m) => m[1]);

describe("generated sections in the Write view (baseline hike)", () => {
  it("finds none when every required pin has a written section", () => {
    expect(ids(BODY)).toEqual([]);
  });

  it("finds a removed section, and writing it puts it back in route order", () => {
    const without = BODY.replace('<Step waypoint="saddle" />\n\n', "");
    const [missing] = missingSections(without, PINS);
    expect(missing.waypoint.id).toBe("saddle");
    const fixed = insertSection(without, missing);
    expect(steps(fixed)).toEqual(steps(BODY));
    expect(ids(fixed)).toEqual([]);
    // Byte for byte the guide before the section was taken out.
    expect(fixed).toBe(BODY);
  });

  it("places sections after the route map when the guide has none, one at a time in route order", () => {
    let body = BODY.replace(/<Step waypoint="[^"]+" \/>\n*/g, "");
    expect(ids(body)).toEqual(["trailhead", "mountain-curve", "saddle", "rocky-climb", "steepest-pitch", "high-point"]);
    for (const id of ["high-point", "trailhead", "saddle"]) body = insertSection(body, missingSections(body, PINS).find((s) => s.waypoint.id === id)!);
    expect(steps(body)).toEqual(["trailhead", "saddle", "high-point"]);
    expect(body.indexOf("<RouteMap />")).toBeLessThan(body.indexOf("<Step"));
    expect(ids(body)).toEqual(["mountain-curve", "rocky-climb", "steepest-pitch"]);
  });

  it("finds nothing in a body the gate would refuse", () => {
    expect(missingSections('<Step waypoint="nope" />', PINS)).toEqual([]);
    expect(missingSections("<Unclosed", PINS)).toEqual([]);
  });
});
