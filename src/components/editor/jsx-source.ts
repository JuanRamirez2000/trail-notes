import { createProcessor } from "@mdx-js/mdx";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { isComponentName, propFields, type ComponentName } from "@/lib/mdx/manifest";
import { attributeValue } from "@/lib/mdx/remark-component-props";

/**
 * Reading and rewriting one component's props in MDX source, for the editor's settings panel.
 * Only the opening tag is ever rewritten, so the component's content, the rest of the document
 * and its formatting are untouched.
 */

export type SourceComponent = {
  name: ComponentName;
  /** Offsets of the whole element and of its opening tag (`<Name …>` or `<Name … />`). */
  start: number;
  end: number;
  openEnd: number;
  selfClosing: boolean;
  /** Literal props (strings, numbers, booleans) as written. */
  props: Record<string, unknown>;
  /** Props written as expressions we can't evaluate, kept verbatim: name → expression source. */
  raw: Record<string, string>;
};

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Frontmatter isn't MDX; blank it out (keeping newlines) so parse offsets match the source. */
const blankFrontmatter = (source: string) => source.replace(FRONTMATTER, (m) => m.replace(/[^\n]/g, " "));

/** End offset (exclusive) of the opening tag starting at `start`, skipping `>` inside quotes and braces. */
export function openingTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i + 1;
  }
  return source.length;
}

/** Every registered component in the source, in document order (outer before inner). */
export function listComponents(source: string): SourceComponent[] {
  let tree;
  try {
    tree = createProcessor().parse(blankFrontmatter(source));
  } catch {
    return []; // mid-edit syntax errors: the preview shows them; the panel just has nothing to show
  }
  const out: SourceComponent[] = [];
  visit(tree, (node) => {
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
    const el = node as MdxJsxFlowElement | MdxJsxTextElement;
    if (!el.name || !isComponentName(el.name) || !el.position) return;
    const start = el.position.start.offset!;
    const openEnd = openingTagEnd(source, start);
    const props: Record<string, unknown> = {};
    const raw: Record<string, string> = {};
    for (const attr of el.attributes) {
      if (attr.type !== "mdxJsxAttribute") continue;
      const value = attributeValue(attr);
      if (typeof value === "symbol") raw[attr.name] = (attr.value as { value: string }).value;
      else props[attr.name] = value;
    }
    out.push({ name: el.name, start, end: el.position.end.offset!, openEnd, selfClosing: source[openEnd - 2] === "/", props, raw });
  });
  return out;
}

/** The innermost component whose opening tag or content contains `offset`. */
export function findComponentAt(source: string, offset: number): SourceComponent | null {
  const hits = listComponents(source).filter((c) => offset >= c.start && offset <= c.end);
  return hits.at(-1) ?? null;
}

const quote = (s: string) => (s.includes('"') ? `{${JSON.stringify(s)}}` : `"${s}"`);

/**
 * Opening tag for `name` with `props`. Props equal to their default (or undefined) are left out,
 * known props come in manifest order, and anything else (internal flags, expressions) is kept.
 */
export function serializeOpeningTag(name: ComponentName, props: Record<string, unknown>, raw: Record<string, string>, selfClosing: boolean) {
  const fields = propFields(name);
  const order = [...fields.map((f) => f.name), ...Object.keys(props), ...Object.keys(raw)].filter((k, i, a) => a.indexOf(k) === i);
  const parts: string[] = [];
  for (const key of order) {
    if (key in raw) {
      parts.push(`${key}={${raw[key]}}`);
      continue;
    }
    const value = props[key];
    const field = fields.find((f) => f.name === key);
    if (value === undefined || value === "" || (field && value === field.default)) continue;
    if (value === true) parts.push(key);
    else if (typeof value === "string") parts.push(`${key}=${quote(value)}`);
    else parts.push(`${key}={${JSON.stringify(value)}}`);
  }
  return `<${name}${parts.length ? ` ${parts.join(" ")}` : ""}${selfClosing ? " />" : ">"}`;
}

/** The source with `component`'s opening tag rewritten for `props`. */
export function setComponentProps(source: string, component: SourceComponent, props: Record<string, unknown>) {
  const tag = serializeOpeningTag(component.name, props, component.raw, component.selfClosing);
  return source.slice(0, component.start) + tag + source.slice(component.openEnd);
}

