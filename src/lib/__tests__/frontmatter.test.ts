import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinGuide, readDetails, setDetail, splitGuide } from "../frontmatter";
import { frontmatterSchema } from "../schemas";

const YAML = `title: Strawberry Peak
slug: strawberry-peak
# the summary shows on the gallery card
summary: An out-and-back from Red Box.
distanceMi: 7.3
trailhead:
  lat: 34.259122
  lng: -118.104093
essentials:
  parking: Red Box parking area.
  hazards:
    - Steep, rocky climb.
date: 2026-04-19`;

describe("splitGuide / joinGuide", () => {
  it.each(["strawberry-peak", "granite-saddle", "ridgeline-loop"])("round-trips %s byte for byte", (slug) => {
    const mdx = readFileSync(`content/hikes/${slug}/index.mdx`, "utf8");
    expect(joinGuide(splitGuide(mdx))).toBe(mdx);
  });

  it("handles a document without frontmatter", () => {
    expect(splitGuide("Just text.\n")).toEqual({ yaml: "", body: "Just text.\n" });
    expect(joinGuide({ yaml: "", body: "Just text." })).toBe("Just text.\n");
  });

  it("always leaves one blank line after the frontmatter and one newline at the end", () => {
    expect(joinGuide({ yaml: "title: T\n", body: "\n\nHello" })).toBe("---\ntitle: T\n---\n\nHello\n");
  });
});

describe("setDetail", () => {
  it("changes one value and leaves every other line, comment and order alone", () => {
    expect(setDetail(YAML, ["distanceMi"], 7.4)).toBe(YAML.replace("distanceMi: 7.3", "distanceMi: 7.4"));
    expect(setDetail(YAML, ["essentials", "parking"], "Lot at Red Box.")).toBe(YAML.replace("Red Box parking area.", "Lot at Red Box."));
    expect(setDetail(YAML, ["trailhead", "lat"], 34.26)).toBe(YAML.replace("34.259122", "34.26"));
  });

  it("adds a new entry, including a nested one whose parent doesn't exist yet", () => {
    expect(readDetails(setDetail(YAML, ["bestSeason"], "spring")).bestSeason).toBe("spring");
    expect(readDetails(setDetail("title: T", ["essentials", "dogs"], "On leash."))).toEqual({ title: "T", essentials: { dogs: "On leash." } });
  });

  it("removes an entry when it's emptied, and the parent when that leaves it empty", () => {
    const noParking = setDetail(YAML, ["essentials", "parking"], "");
    expect(readDetails(noParking).essentials).toEqual({ hazards: ["Steep, rocky climb."] });
    const none = setDetail(noParking, ["essentials", "hazards"], []);
    expect(readDetails(none)).not.toHaveProperty("essentials");
    expect(none).toContain("# the summary shows on the gallery card");
  });

  it("replaces a list and quotes text that YAML would misread", () => {
    const out = setDetail(YAML, ["essentials", "hazards"], ["Loose rock: mile 3.2", "No water"]);
    expect(readDetails(out).essentials).toMatchObject({ hazards: ["Loose rock: mile 3.2", "No water"] });
    expect(readDetails(setDetail(YAML, ["title"], "Yes: a title #1")).title).toBe("Yes: a title #1");
  });

  it("keeps the real guide's details valid after an edit", () => {
    const { yaml } = splitGuide(readFileSync("content/hikes/strawberry-peak/index.mdx", "utf8"));
    const edited = setDetail(setDetail(yaml, ["sidebar"], ["steps", "minimap"]), ["draft"], true);
    expect(frontmatterSchema.parse(readDetails(edited))).toMatchObject({ sidebar: ["steps", "minimap"], draft: true, title: "Strawberry Peak" });
  });
});
