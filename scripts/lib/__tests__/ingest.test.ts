import { describe, expect, it } from "vitest";
import { inferHeadings, kebab } from "../ingest";

describe("kebab", () => {
  it.each([
    ["IMG_3101.JPG", "img-3101"],
    ["Ridge view (2).jpeg", "ridge-view-2"],
    ["__x__.png", "x"],
  ])("%s → %s", (input, out) => expect(kebab(input)).toBe(out));
});

describe("inferHeadings", () => {
  const at = (lat: number, lng: number, heading: number | null = null) => ({ lat, lng, heading });

  it("keeps EXIF headings, rounded to 0.1°", () => {
    expect(inferHeadings([at(34, -118, 12.345)])).toEqual([{ heading: 12.3, headingSource: "exif" }]);
  });

  it("points at the next photo taken somewhere else", () => {
    const [first] = inferHeadings([at(34, -118), at(34.00001, -118), at(34, -117.99)]);
    expect(first.headingSource).toBe("inferred");
    expect(first.heading).toBeCloseTo(90, 0); // skips the same-spot photo, faces east
  });

  it("leaves the last photo blank", () => {
    expect(inferHeadings([at(34, -118), at(34.01, -118)])[1]).toEqual({ heading: null, headingSource: null });
  });
});
