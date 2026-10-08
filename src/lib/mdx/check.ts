import { compile } from "@mdx-js/mdx";
import type { Waypoint } from "../schemas";
import { blankFrontmatter } from "../frontmatter";
import { guideRemarkPlugins } from "./plugins";

type MdxError = Error & { line?: number; place?: { line?: number; start?: { line?: number } } };

/** `line N: message` for an MDX compile error. */
export function describeMdxError(e: unknown): string {
  const err = e as MdxError;
  const line = err.line ?? err.place?.start?.line ?? err.place?.line;
  return `${line ? `line ${line}: ` : ""}${err.message}`;
}

/**
 * Compiles a guide with the shared remark passes and returns the first problem, or null if it
 * would render. This is the save gate: nothing that fails here is ever stored.
 */
export async function checkMdx(source: string, waypoints: Waypoint[] | null): Promise<string | null> {
  try {
    await compile(blankFrontmatter(source), { remarkPlugins: guideRemarkPlugins(waypoints) });
    return null;
  } catch (e) {
    return describeMdxError(e);
  }
}
