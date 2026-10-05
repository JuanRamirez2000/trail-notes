import type { Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

/** Plain HTML tags a guide may use. Everything else must be a component from the manifest. */
const SAFE_TAGS = new Set(["br", "sub", "sup", "kbd", "mark", "details", "summary"]);

const isComment = (source: string) => /^\s*(\/\*[\s\S]*?\*\/\s*)*$/.test(source);

/** A literal the prop checker can read: number, boolean, null, quoted string, or JSON array/object. */
function isLiteral(source: string): boolean {
  const s = source.trim();
  if (/^'[^'\\]*'$/.test(s)) return true;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Guides are content, not programs. Compiled MDX is run as code when a page renders, so anything
 * that lets a guide carry its own code is refused here, before it can be saved or compiled:
 *  - `import` / `export` lines
 *  - `{…}` expressions in the text (comments are fine)
 *  - props written as expressions (`a={x}`, `{...spread}`); literals like `{420}` or `{false}` are fine
 *  - raw HTML tags other than a few harmless ones, and any attribute on those
 * Components come only from lib/mdx/manifest.ts and ship with the site's code.
 */
export function remarkNoCode() {
  return (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      switch (node.type) {
        case "mdxjsEsm":
          file.fail("Guides can't contain import or export lines", node);
          break;
        case "mdxFlowExpression":
        case "mdxTextExpression":
          if (!isComment(node.value)) file.fail(`Guides can't contain {…} expressions (found {${node.value.trim().slice(0, 40)}})`, node);
          break;
        case "mdxJsxFlowElement":
        case "mdxJsxTextElement": {
          const el = node as MdxJsxFlowElement | MdxJsxTextElement;
          const name = el.name ?? "";
          const isComponent = /^[A-Z]/.test(name);
          if (!isComponent && !SAFE_TAGS.has(name)) {
            file.fail(`<${name || ">"}> isn't allowed in a guide. Use a component, or one of: ${[...SAFE_TAGS].join(", ")}`, el);
          }
          for (const attr of el.attributes) {
            if (attr.type !== "mdxJsxAttribute") file.fail(`<${name}>: spread props ({...x}) aren't allowed`, el);
            if (!isComponent) file.fail(`<${name}> can't have attributes in a guide`, el);
            const v = attr.value;
            if (v && typeof v === "object" && !isLiteral(v.value)) {
              file.fail(`<${name} ${attr.name}>: only plain values are allowed (text, numbers, true/false), not {${v.value.trim().slice(0, 40)}}`, el);
            }
          }
          break;
        }
      }
    });
  };
}
