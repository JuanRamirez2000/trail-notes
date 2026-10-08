import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankFrontmatter, joinGuide, readDetails, setDetail, splitGuide, yamlProblems } from "../frontmatter";
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
    const edited = setDetail(setDetail(yaml, ["sidebar"], ["steps", "minimap"]), ["estTime"], "4 hours");
    expect(frontmatterSchema.parse(readDetails(edited))).toMatchObject({ sidebar: ["steps", "minimap"], estTime: "4 hours", title: "Strawberry Peak" });
  });
});

describe("frontmatter that isn't valid YAML", () => {
  it.each([
    ["a tab indent", "title: T\nessentials:\n\tparking: lot"],
    ["a duplicate key", "title: A\ntitle: B"],
    ["an unclosed quote", 'title: "A'],
    ["a second colon", "title: A: B"],
    ["a list", "- one\n- two"],
  ])("is reported, not rewritten: %s", (_what, yaml) => {
    expect(yamlProblems(yaml).length).toBeGreaterThan(0);
    expect(() => setDetail(yaml, ["draft"], false)).toThrow(/can't be edited/);
  });

  it("reads as no details rather than as half of them", () => {
    expect(readDetails("title: A: B")).toEqual({});
  });

  it("has no problems when it's fine, or empty", () => {
    expect(yamlProblems(YAML)).toEqual([]);
    expect(yamlProblems("")).toEqual([]);
    expect(setDetail("", ["draft"], true)).toBe("draft: true");
  });
});

describe("Windows line endings", () => {
  const crlf = "---\r\ntitle: T\r\n---\r\n\r\nBody.\r\n";
  it("splits and joins without mixing line endings", () => {
    const doc = splitGuide(crlf);
    expect(doc).toEqual({ yaml: "title: T", body: "Body.\r\n" });
    expect(joinGuide(doc)).toBe(crlf);
  });
});

describe("blankFrontmatter", () => {
  it("keeps every line and offset where it was", () => {
    const src = "---\ntitle: T\n---\n\nBody.";
    const out = blankFrontmatter(src);
    expect(out).toHaveLength(src.length);
    expect(out.indexOf("Body.")).toBe(src.indexOf("Body."));
    expect(out.split("\n")).toHaveLength(src.split("\n").length);
    expect(out.slice(0, src.indexOf("Body.")).trim()).toBe("");
  });
});
