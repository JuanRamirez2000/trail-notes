import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";

/**
 * Blocks every guide has unless the author places them somewhere else: today just
 * <BeforeYouGo />, which goes first (where the page layout used to render it).
 * An author-placed block is left where it is, the same idea as auto <Step> stubs.
 */
export function remarkDefaultBlocks() {
  return (tree: Root) => {
    let placed = false;
    visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement) => {
      if (node.name === "BeforeYouGo") placed = true;
    });
    if (placed) return;
    const block: MdxJsxFlowElement = {
      type: "mdxJsxFlowElement",
      name: "BeforeYouGo",
      attributes: [{ type: "mdxJsxAttribute", name: "auto", value: null }],
      children: [],
    };
    tree.children.unshift(block);
  };
}
