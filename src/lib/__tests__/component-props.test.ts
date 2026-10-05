import { compile } from "@mdx-js/mdx";
import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { COMPONENT_NAMES, propFields } from "../mdx/manifest";
import { attributeValue, remarkComponentProps } from "../mdx/remark-component-props";
import { remarkDefaultBlocks } from "../mdx/remark-default-blocks";
import { remarkStepSections } from "../mdx/remark-step-sections";
import { frontmatterSchema } from "../schemas";
import { wp } from "./fixtures";

const WAYPOINTS = [wp("trailhead", 10, "start"), wp("saddle", 20, "note")];

/** Same plugin order as velite.config.ts and the editor preview. */
async function build(source: string) {
  let tree: Root | undefined;
  await compile(source, {
    remarkPlugins: [
      [remarkStepSections, { getWaypoints: () => WAYPOINTS }],
      remarkDefaultBlocks,
      [remarkComponentProps, { getWaypoints: () => WAYPOINTS }],
      () => (t: Root) => void (tree = t),
    ],
  });
  return tree!.children.filter((n): n is MdxJsxFlowElement => n.type === "mdxJsxFlowElement").map((n) => n.name);
}

describe("propFields (editor-facing prop description)", () => {
  it("describes RouteMap's props with labels, defaults and ranges", () => {
    expect(propFields("RouteMap")).toEqual([
      { name: "height", label: "Height (px)", kind: "integer", required: false, default: 320, min: 160, max: 800, options: undefined },
      { name: "labels", label: "Pin labels", kind: "boolean", required: false, default: true, min: undefined, max: undefined, options: undefined },
      { name: "terrain", label: "3D terrain", kind: "boolean", required: false, default: true, min: undefined, max: undefined, options: undefined },
    ]);
  });

  it("marks pin references and hides internal props", () => {
    const fields = propFields("Step");
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["waypoint", "waypoint", true],
      ["hidePhoto", "boolean", false],
    ]);
  });

  it("covers every component", () => {
    for (const name of COMPONENT_NAMES) expect(() => propFields(name)).not.toThrow();
  });
});

describe("attributeValue", () => {
  it.each([
    [{ value: "x" }, "x"],
    [{ value: null }, true],
    [{ value: { value: "420" } }, 420],
    [{ value: { value: "false" } }, false],
    [{ value: { value: "'single'" } }, "single"],
  ])("%j → %j", (attr, out) => expect(attributeValue(attr)).toEqual(out));
});

describe("remarkComponentProps", () => {
  it("accepts valid props, including literals in braces", async () => {
    await expect(build('<RouteMap height={420} labels terrain={false} />\n\n<Step waypoint="saddle">\n\nNotes.\n\n</Step>')).resolves.toBeDefined();
  });

  it.each([
    ["an unknown prop", "<RouteMap heigth={300} />", /<RouteMap>: unknown prop "heigth" \(allowed: height, labels, terrain\)/],
    ["a wrong type", '<RouteMap height="tall" />', /<RouteMap>: height: /],
    ["an out-of-range number", "<RouteMap height={20} />", /<RouteMap>: height: /],
    ["an unknown component", "<Elevation />", /Unknown component <Elevation>/],
    ["a bad pin reference", '<PhotoCard waypoint="nowhere" />', /<PhotoCard waypoint="nowhere"> doesn't match any waypoint/],
    ["a missing required prop", "<PhotoCard />", /<PhotoCard>: waypoint: /],
    ["content in a no-content component", "<RouteMap>\n\nhello\n\n</RouteMap>", /<RouteMap> doesn't take content/],
  ])("fails on %s", async (_what, src, message) => {
    await expect(build(src)).rejects.toThrow(message);
  });

  it("skips props written as non-literal expressions", async () => {
    await expect(build("<RouteMap height={2 * 200} />")).resolves.toBeDefined();
  });

  it("ignores plain HTML tags", async () => {
    await expect(build('<div className="note">hi</div>')).resolves.toBeDefined();
  });
});

describe("remarkDefaultBlocks", () => {
  it("puts <BeforeYouGo /> first when the guide doesn't place it", async () => {
    expect((await build("<RouteMap />"))[0]).toBe("BeforeYouGo");
  });

  it("leaves an author-placed <BeforeYouGo /> where it is", async () => {
    const names = await build("<RouteMap />\n\n<BeforeYouGo />");
    expect(names.filter((n) => n === "BeforeYouGo")).toHaveLength(1);
    expect(names.indexOf("BeforeYouGo")).toBeGreaterThan(names.indexOf("RouteMap"));
  });
});

describe("frontmatter sidebar", () => {
  const base = { title: "T", slug: "t", region: "R", summary: "S", distanceMi: 1, elevationGainFt: 0, difficulty: "easy", trailhead: { lat: 0, lng: 0 }, date: "2026-01-01" };
  it("accepts a reordered subset", () => {
    expect(frontmatterSchema.parse({ ...base, sidebar: ["steps", "minimap"] }).sidebar).toEqual(["steps", "minimap"]);
  });
  it("rejects unknown and repeated cards", () => {
    expect(frontmatterSchema.safeParse({ ...base, sidebar: ["map"] }).success).toBe(false);
    expect(frontmatterSchema.safeParse({ ...base, sidebar: ["steps", "steps"] }).success).toBe(false);
  });
});

describe("checkMdx (the editor's save gate)", () => {
  it("passes a valid guide and reports the line of a bad prop", async () => {
    const { checkMdx } = await import("../mdx/check");
    const fm = "---\ntitle: T\n---\n\n";
    expect(await checkMdx(`${fm}<RouteMap />`, WAYPOINTS)).toBeNull();
    expect(await checkMdx(`${fm}Intro.\n\n<RouteMap heigth={1} />`, WAYPOINTS)).toMatch(/^line 7: <RouteMap>: unknown prop "heigth"/);
    expect(await checkMdx(`${fm}<RouteMap height={`, WAYPOINTS)).toMatch(/line \d+/);
  });
});

describe("remarkNoCode (guides can't carry code)", () => {
  const gate = async (src: string) => (await import("../mdx/check")).checkMdx(src, WAYPOINTS);

  it.each([
    ["an import", "import fs from 'fs'\n\nHi", /import or export/],
    ["an export", "export const x = 1\n\nHi", /import or export/],
    ["an expression in text", "Total: {1 + 1}", /can't contain \{…\} expressions/],
    ["a block expression", "{globalThis.process.exit()}", /can't contain \{…\} expressions/],
    ["a prop written as an expression", "<RouteMap height={2 * 200} />", /only plain values/],
    ["spread props", "<RouteMap {...{ height: 400 }} />", /spread props/],
    ["a script tag", "<script>alert(1)</script>", /<script> isn't allowed/],
    ["an iframe", '<iframe src="https://example.com" />', /<iframe> isn't allowed/],
    ["attributes on an allowed tag", '<details open onToggle="x()">\n\nhi\n\n</details>', /can't have attributes/],
  ])("refuses %s", async (_what, src, message) => {
    expect(await gate(src)).toMatch(message);
  });

  it("allows comments, literal props and the harmless tags", async () => {
    expect(await gate("{/* a note to self */}\n\n<RouteMap height={420} labels terrain={false} />\n\nH<sub>2</sub>O\n\n<details>\n\n<summary>More</summary>\n\nText.\n\n</details>")).toBeNull();
  });
});
