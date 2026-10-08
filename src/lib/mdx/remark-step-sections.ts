import type { Root, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { requiresSection } from "../pins";
import type { Waypoint } from "../schemas";
import { attributeValue } from "./remark-component-props";

type Parent = { children: RootContent[] };
type Authored = { node: MdxJsxFlowElement; parent: Parent; wp: Waypoint };

export type StepSectionsOptions = {
  /** Waypoints for the file being compiled, or null to skip (e.g. the hike has none yet). */
  getWaypoints: (file: VFile) => Waypoint[] | null;
};

const stub = (id: string): MdxJsxFlowElement => ({
  type: "mdxJsxFlowElement",
  name: "Step",
  attributes: [
    { type: "mdxJsxAttribute", name: "waypoint", value: id },
    { type: "mdxJsxAttribute", name: "auto", value: null },
  ],
  children: [],
});

const waypointAttr = (node: MdxJsxFlowElement) => {
  const attr = node.attributes.find((a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "waypoint");
  // `waypoint="a"` or the literal `waypoint={"a"}`; both are accepted by the no-code pass.
  const value = attr ? attributeValue(attr) : undefined;
  return typeof value === "string" ? value : undefined;
};

/**
 * Makes sure every waypoint whose pin type requires a guide section has one.
 *
 * Authored `<Step waypoint="…">` blocks are kept where they are. For each required waypoint
 * without one, a `<Step waypoint="…" auto />` stub is inserted in route order: just before the
 * first authored step that comes later on the trail, or after the last authored step. A post
 * with no <Step> blocks at all gets its stubs after the first <RouteMap />, or at the end.
 *
 * Fails the compile on a <Step> pointing at an unknown waypoint, or the same waypoint twice.
 */
export function remarkStepSections({ getWaypoints }: StepSectionsOptions) {
  return (tree: Root, file: VFile) => {
    const waypoints = getWaypoints(file);
    if (!waypoints) return;
    const byId = new Map(waypoints.map((w) => [w.id, w]));

    // A <Step> in the middle of a line isn't a section; it would render inside the paragraph and
    // its pin would get a second, generated section with the same id.
    visit(tree, "mdxJsxTextElement", (node: MdxJsxTextElement) => {
      if (node.name === "Step") file.fail("<Step> must be on its own line, not inside a paragraph", node);
    });

    const authored: Authored[] = [];
    let routeMap: { node: RootContent; parent: Parent } | undefined;
    visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement, _i, parent) => {
      if (!parent) return;
      if (node.name === "RouteMap" && !routeMap) routeMap = { node, parent: parent as Parent };
      if (node.name !== "Step") return;
      const id = waypointAttr(node);
      const wp = id ? byId.get(id) : undefined;
      if (!wp) file.fail(`<Step waypoint="${id ?? ""}"> doesn't match any waypoint in waypoints.json`, node);
      if (authored.some((a) => a.wp.id === wp.id)) file.fail(`Two <Step> blocks for waypoint "${wp.id}"`, node);
      authored.push({ node, parent: parent as Parent, wp });
    });

    const have = new Set(authored.map((a) => a.wp.id));
    const missing = [...waypoints].sort((a, b) => a.order - b.order).filter((w) => requiresSection(w.type) && !have.has(w.id));
    if (!missing.length) return;

    // Fallback anchor for stubs that come after every authored step (or when none exist).
    let tail: { node: RootContent; parent: Parent } | undefined = authored.length
      ? authored.reduce((last, a) => (a.wp.order > last.wp.order ? a : last))
      : routeMap;

    for (const wp of missing) {
      const node = stub(wp.id);
      const next = authored.filter((a) => a.wp.order > wp.order).sort((a, b) => a.wp.order - b.wp.order)[0];
      if (next) {
        next.parent.children.splice(next.parent.children.indexOf(next.node), 0, node);
      } else if (tail) {
        tail.parent.children.splice(tail.parent.children.indexOf(tail.node) + 1, 0, node);
        tail = { node, parent: tail.parent };
      } else {
        tree.children.push(node);
      }
    }
  };
}
