import type { Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import type { z } from "zod";
import type { Waypoint } from "../schemas";
import { COMPONENT_NAMES, isComponentName, manifest, propFields } from "./manifest";

export type ComponentPropsOptions = {
  /** Waypoints of the file being compiled, to check pin references; null skips that check. */
  getWaypoints: (file: VFile) => Waypoint[] | null;
};

/** Sentinel for an expression we can't evaluate at build time (e.g. `{someVariable}`): not checked. */
const OPAQUE = Symbol("opaque");

/**
 * The value an attribute is written with: `a="x"` → "x", bare `a` → true, `a={420}` → 420.
 * Only literals are evaluated (numbers, booleans, null, quoted strings, JSON arrays/objects).
 */
export function attributeValue(attr: { value?: unknown }): unknown {
  const v = attr.value;
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v;
  const expr = (v as { value?: string }).value?.trim() ?? "";
  try {
    return JSON.parse(expr.replace(/^'(.*)'$/s, (_m, s: string) => JSON.stringify(s)));
  } catch {
    return OPAQUE;
  }
}

/**
 * Checks every capitalised JSX element against lib/mdx/manifest.ts: the component exists, its
 * props match the schema (unknown props, wrong types, out-of-range numbers), components that
 * take no content have none, and pin references point at a real waypoint. Fails the compile
 * with a readable message, like an unknown <Step waypoint> does.
 */
export function remarkComponentProps({ getWaypoints }: ComponentPropsOptions) {
  return (tree: Root, file: VFile) => {
    const waypoints = getWaypoints(file);
    const ids = waypoints ? new Set(waypoints.map((w) => w.id)) : null;

    visit(tree, (node) => {
      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
      const el = node as MdxJsxFlowElement | MdxJsxTextElement;
      const name = el.name;
      if (!name || !/^[A-Z]/.test(name)) return; // fragments and plain HTML tags
      if (!isComponentName(name)) {
        file.fail(`Unknown component <${name}>. Available: ${COMPONENT_NAMES.join(", ")}`, el);
      }
      const entry = manifest[name];
      const shape: z.ZodObject = entry.props;

      const props: Record<string, unknown> = {};
      const opaque = new Set<string>();
      for (const attr of el.attributes) {
        if (attr.type !== "mdxJsxAttribute") file.fail(`<${name}>: spread props ({...x}) aren't supported`, el);
        const value = attributeValue(attr);
        if (value === OPAQUE) opaque.add(attr.name);
        else props[attr.name] = value;
      }

      // Props written as non-literal expressions can't be checked here; still check the rest.
      const known = Object.keys(shape.shape);
      const skip: Record<string, true> = {};
      for (const k of opaque) if (known.includes(k)) skip[k] = true;
      const schema = shape.omit(skip as Parameters<typeof shape.omit>[0]);
      const parsed = schema.safeParse(props);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const what =
          issue.code === "unrecognized_keys"
            ? `unknown prop${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")} (allowed: ${propFields(name).map((f) => f.name).join(", ") || "none"})`
            : `${issue.path.join(".") || "props"}: ${issue.message}`;
        file.fail(`<${name}>: ${what}`, el);
      }

      if (entry.children === "none" && el.children.some((c) => !(c.type === "text" && !c.value.trim()))) {
        file.fail(`<${name}> doesn't take content; write it as <${name} />`, el);
      }

      if (ids) {
        for (const field of propFields(name)) {
          const ref = props[field.name];
          if (field.kind === "waypoint" && typeof ref === "string" && !ids.has(ref)) {
            file.fail(`<${name} ${field.name}="${ref}"> doesn't match any waypoint in waypoints.json`, el);
          }
        }
      }
    });
  };
}
