import { compile } from "@mdx-js/mdx";
import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { COMPONENT_NAMES, propFields } from "../mdx/manifest";
import { guideRemarkPlugins } from "../mdx/plugins";
import { attributeValue } from "../mdx/remark-component-props";
import { isComment } from "../mdx/remark-no-code";
import { frontmatterSchema } from "../schemas";
import { wp } from "./fixtures";

const WAYPOINTS = [wp("trailhead", 10, "start"), wp("saddle", 20, "note")];

/** The passes every guide goes through (the one list in mdx/plugins.ts), then a look at the result. */
async function build(source: string) {
  let tree: Root | undefined;
  await compile(source, { remarkPlugins: [...guideRemarkPlugins(WAYPOINTS), () => (t: Root) => void (tree = t)] });
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

  it("refuses a prop named like an Object member instead of letting it past the unknown-prop check", async () => {
    await expect(build('<RouteMap __proto__={{"zzz":1}} />')).rejects.toThrow(/unknown prop "__proto__"/);
    await expect(build("<RouteMap constructor={1} />")).rejects.toThrow(/unknown prop "constructor"/);
  });

  it("reads a pin reference written as a literal in braces", async () => {
    expect(await build('<Step waypoint={"saddle"}>\n\nNotes.\n\n</Step>')).toContain("Step");
  });

  it("refuses a <Step> in the middle of a line", async () => {
    await expect(build('Text <Step waypoint="saddle" /> more')).rejects.toThrow(/own line/);
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

  // A comment check that backtracks reads `/* a */ code /* b */` as one comment and runs the code.
  it.each([
    ["code between two comments", 'Hello {/* x */ globalThis.__pwned = "gate" /* y */}'],
    ["code between two comments, as a block", "{/* a */ globalThis.__pwned = 2 /* b */}"],
    ["code after a comment", "{/* a */ process.exit()}"],
    ["code before a comment", "{process.exit() /* a */}"],
    ["an unclosed comment", "{/* a */ /* b}"],
    ["a line comment", "{// a\n}"],
    ["an expression in a heading", "## Total {1 + 1}"],
    ["an expression in a link", "[x {1 + 1}](https://example.com)"],
    ["an expression inside an allowed tag", "<kbd>{globalThis.x}</kbd>"],
    ["an expression inside a component", '<Step waypoint="saddle">\n\n{globalThis.x}\n\n</Step>'],
  ])("refuses %s", async (_what, src) => {
    expect(await gate(src)).toMatch(/can't contain \{…\} expressions|Could not parse/);
  });

  it.each([
    ["a comment sandwich in a prop", "<RouteMap height={/* a */ 2 * 200 /* b */} />", /only plain values/],
    ["a template literal prop", "<RouteMap height={`${1}`} />", /only plain values/],
    ["a function prop", "<RouteMap labels={() => 1} />", /only plain values/],
    ["dangerouslySetInnerHTML", '<RouteMap dangerouslySetInnerHTML={{"__html":"<b>x</b>"}} />', /unknown prop/],
    ["a fragment with a member name", "<a.b />", /isn't allowed/],
    ["a plain HTML tag", '<div className="note">hi</div>', /<div> isn't allowed/],
    ["an img tag", '<img src="x" onerror="alert(1)" />', /<img> isn't allowed/],
    ["a javascript: link", "[x](javascript:alert(1))", /Links can only point to web pages/],
    ["a javascript: link with a tab in the scheme", "[x](java&#x09;script:alert(1))", /Links can only point to web pages/],
    ["a data: image", "![x](data:text/html,<script>alert(1)</script>)", /Links can only point to web pages/],
    ["a javascript: link definition", "[x][1]\n\n[1]: javascript:alert(1)", /Links can only point to web pages/],
  ])("refuses %s", async (_what, src, message) => {
    expect(await gate(src)).toMatch(message);
  });

  it("allows ordinary links", async () => {
    expect(await gate("[a](https://example.com) [b](/hikes/x) [c](#step-saddle) [d](mailto:a@example.com) [e](tel:+15551234)")).toBeNull();
  });

  it("decides what is a comment in time proportional to its length", () => {
    expect(isComment("/* a */ /* b */\n")).toBe(true);
    expect(isComment("")).toBe(true);
    expect(isComment("/* a */ x /* b */")).toBe(false);
    // 40 comments then code: the old pattern doubled its time with each one (hours at this size).
    const started = performance.now();
    expect(isComment(`${"/**/".repeat(40)} x`)).toBe(false);
    expect(isComment(`${"/**/".repeat(200_000)} x`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("allows comments, literal props and the harmless tags", async () => {
    expect(await gate("{/* a note to self */}\n\n<RouteMap height={420} labels terrain={false} />\n\nH<sub>2</sub>O\n\n<details>\n\n<summary>More</summary>\n\nText.\n\n</details>")).toBeNull();
  });
});
