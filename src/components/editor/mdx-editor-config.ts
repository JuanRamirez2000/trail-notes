import {
  frontmatterPlugin,
  GenericJsxEditor,
  headingsPlugin,
  jsxPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  type JsxComponentDescriptor,
} from "@mdxeditor/editor";
import { COMPONENT_NAMES, manifest, propFields } from "@/lib/mdx/manifest";

/**
 * Shared MDXEditor setup for the rich-text "Write" mode (V2 E3) and its round-trip test.
 *
 * Round trips are structurally lossless on every guide (frontmatter, JSX props, MDX expression comments and markdown
 * inside <Step> all survive; see __tests__/roundtrip.test.tsx). These options keep
 * the output in the house style; what's left is normalised once and then stable:
 *   - children of block components are indented by 2 spaces (mdast-util-mdx-jsx; MDX strips it)
 *   - `_emphasis_` becomes `*emphasis*`
 *   - the trailing newline is dropped (the save gate adds it back)
 */
export const toMarkdownOptions = { bullet: "-", rule: "-", emphasis: "*", strong: "*" } as const;

/**
 * One rich-text block per manifest component. `Editor` is what renders the block: the Write view
 * passes one that shows the real component; the default is MDXEditor's generic prop table.
 */
export function jsxDescriptors(Editor: JsxComponentDescriptor["Editor"] = GenericJsxEditor): JsxComponentDescriptor[] {
  return COMPONENT_NAMES.map((name) => ({
    name,
    kind: "flow",
    hasChildren: manifest[name].children === "markdown",
    props: propFields(name).map((f) => ({
      name: f.name,
      type: f.kind === "boolean" || f.kind === "number" || f.kind === "integer" ? "expression" : "string",
      required: f.required,
    })),
    Editor,
  }));
}

/** The plugins every MDXEditor instance of ours uses (the Write view adds its toolbar and link dialog). */
export function editorPlugins(Editor?: JsxComponentDescriptor["Editor"]) {
  return [
    headingsPlugin({ allowedHeadingLevels: [2, 3] }),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    thematicBreakPlugin(),
    frontmatterPlugin(),
    markdownShortcutPlugin(),
    jsxPlugin({ jsxComponentDescriptors: jsxDescriptors(Editor) }),
  ];
}
