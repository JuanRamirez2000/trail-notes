import { compile } from "@mdx-js/mdx";
import type { Root } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { remarkStepSections } from "../mdx/remark-step-sections";
import type { Waypoint } from "../schemas";
import { wp } from "./fixtures";

const WAYPOINTS: Waypoint[] = [
  wp("trailhead", 10, "start"),
  wp("fork", 20, "turn"),
  wp("vista", 30, "viewpoint"),
  wp("creek", 40, "water"),
  wp("scree", 50, "note"),
  wp("escape", 60, "bailout"),
];

/** Runs the plugin through the real MDX pipeline; returns top-level components as "Name:id[:auto]". */
async function sections(source: string, waypoints: Waypoint[] | null = WAYPOINTS) {
  let tree: Root | undefined;
  const capture = () => (t: Root) => {
    tree = t;
  };
  await compile(source, { remarkPlugins: [[remarkStepSections, { getWaypoints: () => waypoints }], capture] });
  const out: string[] = [];
  visit(tree!, "mdxJsxFlowElement", (node: MdxJsxFlowElement) => {
    const attr = (n: string) => node.attributes.find((a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === n);
    const id = attr("waypoint")?.value;
    out.push([node.name, id, attr("auto") ? "auto" : undefined].filter(Boolean).join(":"));
  });
  return out;
}

describe("remarkStepSections", () => {
  it("adds stubs for every required pin after the first RouteMap when nothing is authored", async () => {
    expect(await sections("Intro\n\n<RouteMap />\n\nOutro\n\n<RouteMap />")).toEqual([
      "RouteMap",
      "Step:trailhead:auto",
      "Step:fork:auto",
      "Step:scree:auto",
      "Step:escape:auto",
      "RouteMap",
    ]);
  });

  it("appends stubs at the end when there is no RouteMap", async () => {
    expect(await sections("Just prose.")).toEqual(["Step:trailhead:auto", "Step:fork:auto", "Step:scree:auto", "Step:escape:auto"]);
  });

  it("slots stubs in route order around authored steps", async () => {
    const src = `<Step waypoint="fork">Go left.</Step>\n\n<Step waypoint="vista">Look.</Step>`;
    expect(await sections(src)).toEqual(["Step:trailhead:auto", "Step:fork", "Step:vista", "Step:scree:auto", "Step:escape:auto"]);
  });

  it("never generates sections for optional pins", async () => {
    const out = await sections("<RouteMap />");
    expect(out).not.toContain("Step:vista:auto");
    expect(out).not.toContain("Step:creek:auto");
  });

  it("keeps the post unchanged when every required pin is authored", async () => {
    const src = ["trailhead", "fork", "scree", "escape"].map((id) => `<Step waypoint="${id}" />`).join("\n\n");
    expect(await sections(src)).toEqual(["Step:trailhead", "Step:fork", "Step:scree", "Step:escape"]);
  });

  it("skips when the hike has no waypoints file", async () => {
    expect(await sections("<RouteMap />", null)).toEqual(["RouteMap"]);
  });

  it("fails on an unknown waypoint", async () => {
    await expect(sections(`<Step waypoint="nope" />`)).rejects.toThrow(/doesn't match any waypoint/);
  });

  it("fails on two steps for the same waypoint", async () => {
    await expect(sections(`<Step waypoint="fork" />\n\n<Step waypoint="fork" />`)).rejects.toThrow(/Two <Step> blocks/);
  });
});
