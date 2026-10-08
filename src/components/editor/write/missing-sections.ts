import { createProcessor } from "@mdx-js/mdx";
import type { Root, RootContent } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { remarkStepSections } from "@/lib/mdx/remark-step-sections";
import type { Waypoint } from "@/lib/schemas";

/** A section the page adds on its own (a `<Step auto>`), and where in the body it appears. */
export type MissingSection = {
  waypoint: Waypoint;
  /** Offset in the body where a written section for it belongs. */
  at: number;
};

/**
 * Which required sections the guide doesn't write itself, found by running the same pass the
 * page uses (remark-step-sections) on the body: whatever stubs it inserts are the missing ones,
 * and their place among the written blocks is where a written section belongs.
 *
 * Returns [] when the body can't be parsed or the pass refuses it; the gate reports that.
 */
export function missingSections(body: string, waypoints: Waypoint[]): MissingSection[] {
  let tree: Root;
  try {
    tree = createProcessor().parse(new VFile(body)) as Root;
    remarkStepSections({ getWaypoints: () => waypoints })(tree, new VFile(body));
  } catch {
    return [];
  }
  const byId = new Map(waypoints.map((w) => [w.id, w]));
  const found: MissingSection[] = [];
  visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement, index, parent) => {
    if (node.name !== "Step" || node.position || !parent || index === undefined) return;
    const id = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "waypoint")?.value;
    const waypoint = typeof id === "string" ? byId.get(id) : undefined;
    if (waypoint) found.push({ waypoint, at: offsetFor(parent.children as RootContent[], index, body.length) });
  });
  return found;
}

/** A stub has no position of its own: it sits after the nearest written block before it, else before the next one. */
function offsetFor(siblings: RootContent[], index: number, end: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const offset = siblings[i].position?.end.offset;
    if (offset !== undefined) return offset;
  }
  for (let i = index + 1; i < siblings.length; i++) {
    const offset = siblings[i].position?.start.offset;
    if (offset !== undefined) return offset;
  }
  return end;
}

/**
 * The body with a section for `section` written in its place. It starts empty (no filler text):
 * the page looks the same until the author types into it, so nothing half-written is published.
 */
export function insertSection(body: string, section: MissingSection): string {
  const block = `<Step waypoint="${section.waypoint.id}" />`;
  const before = body.slice(0, section.at).replace(/\s*$/, "");
  const after = body.slice(section.at).replace(/^\s*/, "");
  return [before, block, after].filter(Boolean).join("\n\n") + (after ? "" : "\n");
}
