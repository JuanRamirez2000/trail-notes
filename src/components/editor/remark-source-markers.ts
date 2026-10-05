import type { Root, RootContent } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { isComponentName } from "@/lib/mdx/manifest";

type Parent = { children: RootContent[] };

/**
 * Editor preview only: wraps every authored block component in `<div data-src-start="N">`, where N
 * is the offset of its `<` in the full source. The preview uses it to select a component by
 * clicking it and to outline the selected one. Generated blocks (auto stubs) have no source
 * position and are left alone. Must run after the other passes, which expect the original tree.
 */
export function remarkSourceMarkers({ offset = 0 }: { offset?: number } = {}) {
  return (tree: Root) => {
    const targets: { node: MdxJsxFlowElement; parent: Parent }[] = [];
    visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement, _i, parent) => {
      if (parent && node.name && isComponentName(node.name) && node.position?.start.offset !== undefined) {
        targets.push({ node, parent: parent as Parent });
      }
    });
    for (const { node, parent } of targets) {
      const wrapper: MdxJsxFlowElement = {
        type: "mdxJsxFlowElement",
        name: "div",
        attributes: [
          { type: "mdxJsxAttribute", name: "data-src-start", value: String(node.position!.start.offset! + offset) },
          { type: "mdxJsxAttribute", name: "data-src-name", value: node.name! },
        ],
        children: [node],
      };
      parent.children[parent.children.indexOf(node)] = wrapper;
    }
  };
}
