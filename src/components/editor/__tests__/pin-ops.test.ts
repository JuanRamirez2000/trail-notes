import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveWaypoints } from "@/lib/hike";
import { waypointsFileSchema, type Track } from "@/lib/schemas";
import { addPin, aimPin, freeId, movePin, referencesTo, removePin, renamePin, reorderPin, snapToTrack, updatePin } from "../pins/pin-ops";

const JSON_TEXT = readFileSync("fixtures/hikes/cedar-ridge/waypoints.json", "utf8");
const MDX = readFileSync("fixtures/hikes/cedar-ridge/index.mdx", "utf8");
const TRACK = JSON.parse(readFileSync("fixtures/hikes/cedar-ridge/track.json", "utf8")) as Track;
const pins = (json: string) => waypointsFileSchema.parse(JSON.parse(json)).waypoints;
const ids = (json: string) => pins(json).sort((a, b) => a.order - b.order).map((w) => w.id);
const byId = (json: string, id: string) => pins(json).find((w) => w.id === id)!;

describe("pin operations on the baseline hike", () => {
  it("leave the file byte-identical when nothing changes", () => {
    expect(updatePin(JSON_TEXT, "saddle", {})).toBe(JSON_TEXT);
  });

  it("updatePin sets and clears fields, and only on that pin", () => {
    const out = updatePin(JSON_TEXT, "saddle", { label: "The saddle", note: "Windy.", caption: "" });
    expect(byId(out, "saddle")).toMatchObject({ label: "The saddle", note: "Windy." });
    expect(byId(out, "saddle").caption).toBeUndefined();
    expect(byId(out, "rocky-climb")).toEqual(byId(JSON_TEXT, "rocky-climb"));
    expect(byId(updatePin(JSON_TEXT, "saddle", { heading: undefined }), "saddle").heading).toBeNull();
  });

  it("movePin snaps a drop near the track onto it and keeps the route order", () => {
    const saddle = byId(JSON_TEXT, "saddle");
    const out = movePin(JSON_TEXT, "saddle", { lat: saddle.lat + 0.0002, lng: saddle.lng + 0.0002 }, TRACK); // ~30 m off
    const moved = byId(out, "saddle");
    expect(snapToTrack(moved, TRACK)).toMatchObject({ lat: moved.lat, lng: moved.lng, snapped: true });
    expect(ids(out)).toEqual(ids(JSON_TEXT));
  });

  it("movePin leaves a pin dropped far from the track where it was put", () => {
    const out = movePin(JSON_TEXT, "saddle", { lat: 34.3, lng: -118.2 }, TRACK);
    expect(byId(out, "saddle")).toMatchObject({ lat: 34.3, lng: -118.2 });
  });

  it("moving a pin along the track changes its mileage on the page", () => {
    const mile = (json: string) => deriveWaypoints(pins(json), TRACK).find((w) => w.id === "saddle")!.mile;
    // a point on the way up, between the pin before it and where it is now
    const [lng, lat] = TRACK.points.find(([, la]) => la > byId(JSON_TEXT, "mountain-curve").lat + 0.004)!;
    const out = movePin(JSON_TEXT, "saddle", { lat, lng }, TRACK);
    expect(mile(JSON_TEXT)).toBeCloseTo(2.4, 1);
    expect(mile(out)).toBeLessThan(mile(JSON_TEXT));
  });

  it("addPin slots a new pin into the route by trail mileage", () => {
    const a = byId(JSON_TEXT, "mountain-curve");
    const b = byId(JSON_TEXT, "saddle");
    // a track point between the two pins
    const between = TRACK.points.find(([, lat]) => lat > a.lat + 0.002 && lat < b.lat - 0.002)!;
    const { json, id } = addPin(JSON_TEXT, { lat: between[1], lng: between[0] }, TRACK);
    expect(id).toBe("pin");
    const order = ids(json);
    expect(order.indexOf(id)).toBe(order.indexOf("mountain-curve") + 1);
    expect(order.indexOf("saddle")).toBe(order.indexOf(id) + 1);
    expect(byId(json, id)).toMatchObject({ type: "note", label: "New pin" });
    expect(pins(json).map((w) => w.order).sort((x, y) => x - y)).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(addPin(json, { lat: between[1], lng: between[0] }, TRACK).id).toBe("pin-2");
  });

  it("addPin without a track puts the pin last", () => {
    const { json, id } = addPin(JSON_TEXT, { lat: 34.26, lng: -118.1 }, null);
    expect(ids(json).at(-1)).toBe(id);
  });

  it("aimPin sets the photo direction toward a point, marked as set by hand", () => {
    const saddle = byId(JSON_TEXT, "saddle");
    const out = aimPin(JSON_TEXT, "saddle", { lat: saddle.lat, lng: saddle.lng + 0.01 }); // due east
    expect(byId(out, "saddle").heading).toBeCloseTo(90, 0);
    expect(byId(out, "saddle").headingSource).toBe("manual");
  });

  it("reorderPin swaps neighbours and stops at the ends", () => {
    expect(ids(reorderPin(JSON_TEXT, "saddle", -1)).slice(1, 3)).toEqual(["saddle", "mountain-curve"]);
    expect(reorderPin(JSON_TEXT, "trailhead", -1)).toBe(JSON_TEXT);
    expect(reorderPin(JSON_TEXT, "high-point", 1)).toBe(JSON_TEXT);
  });

  it("removePin removes one pin and renumbers", () => {
    const out = removePin(JSON_TEXT, "steepest-pitch");
    expect(ids(out)).not.toContain("steepest-pitch");
    expect(pins(out).map((w) => w.order).sort((x, y) => x - y)).toEqual([10, 20, 30, 40, 50]);
  });

  it("renamePin renames the pin and every block that points at it", () => {
    expect(referencesTo(MDX, "saddle")).toBe(1);
    const r = renamePin(JSON_TEXT, MDX, "saddle", "lawlor-saddle");
    expect(r.ok && ids(r.json)).toContain("lawlor-saddle");
    expect(r.ok && referencesTo(r.mdx, "lawlor-saddle")).toBe(1);
    expect(r.ok && referencesTo(r.mdx, "saddle")).toBe(0);
  });

  it("renamePin refuses a bad or taken id", () => {
    expect(renamePin(JSON_TEXT, MDX, "saddle", "The Saddle")).toMatchObject({ ok: false });
    expect(renamePin(JSON_TEXT, MDX, "saddle", "rocky-climb")).toMatchObject({ ok: false, problem: expect.stringContaining("already") });
  });

  it("freeId skips ids in use", () => {
    expect(freeId(JSON_TEXT)).toBe("pin");
    expect(freeId(JSON_TEXT, "saddle")).toBe("saddle-2");
  });
});

describe("pin references, however the guide writes them", () => {
  const doc = [`<Step waypoint="a">`, `<PhotoCard waypoint='a' />`, `<Minimap waypoint = "a" />`, `<PanoViewer waypoint={"a"} />`, `<Step waypoint="ab">`].join("\n\n");
  const pinsJson = JSON.stringify({ waypoints: [{ id: "a", order: 10, type: "note", label: "A", title: "A", lat: 34, lng: -118 }] });

  it("counts all of them", () => {
    expect(referencesTo(doc, "a")).toBe(4);
    expect(referencesTo(doc, "ab")).toBe(1);
  });

  it("renames all of them, keeping how each was written", () => {
    const r = renamePin(pinsJson, doc, "a", "b");
    expect(r.ok && r.mdx).toBe(doc.replace(`"a">`, `"b">`).replace(`'a'`, `'b'`).replace(`= "a"`, `= "b"`).replace(`{"a"}`, `{"b"}`));
    expect(r.ok && referencesTo(r.mdx, "a")).toBe(0);
  });
});
