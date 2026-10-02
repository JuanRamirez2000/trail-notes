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

/**
 * Shared MDXEditor setup for the rich-text "Write" mode (V2 E2) and its round-trip test.
 *
 * Round trips are structurally lossless on every guide (frontmatter, JSX props, MDX expression comments and markdown
 * inside <Step> all survive; see __tests__/roundtrip.test.tsx). These options keep
 * the output in the house style; what's left is normalised once and then stable:
 *   - children of block components are indented by 2 spaces (mdast-util-mdx-jsx; MDX strips it)
 *   - `_emphasis_` becomes `*emphasis*`
 *   - the trailing newline is dropped (writeHikeFiles adds it back)
 */
export const toMarkdownOptions = { bullet: "-", rule: "-", emphasis: "*", strong: "*" } as const;

/** Block components: until the E1 manifest exists, every registry component uses the generic editor. */
export function jsxDescriptors(names: string[], withChildren: string[] = ["Step"]): JsxComponentDescriptor[] {
  return names.map((name) => ({ name, kind: "flow", props: [], hasChildren: withChildren.includes(name), Editor: GenericJsxEditor }));
}

export function editorPlugins(componentNames: string[]) {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    thematicBreakPlugin(),
    frontmatterPlugin(),
    markdownShortcutPlugin(),
    jsxPlugin({ jsxComponentDescriptors: jsxDescriptors(componentNames) }),
  ];
}
