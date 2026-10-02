import { compile } from "@mdx-js/mdx";
import type { Waypoint } from "../schemas";
import { remarkComponentProps } from "./remark-component-props";
import { remarkDefaultBlocks } from "./remark-default-blocks";
import { remarkStepSections } from "./remark-step-sections";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/**
 * Compiles a guide's MDX body with the same remark passes as the Velite build and returns the
 * first problem, or null if it would build. Used by the editor's save API so nothing that would
 * break `pnpm build` is ever written to disk.
 */
export async function checkMdx(source: string, waypoints: Waypoint[] | null): Promise<string | null> {
  // Keep line numbers right: blank the frontmatter instead of cutting it.
  const body = source.replace(FRONTMATTER, (m) => m.replace(/[^\n]/g, ""));
  try {
    await compile(body, {
      remarkPlugins: [
        [remarkStepSections, { getWaypoints: () => waypoints }],
        remarkDefaultBlocks,
        [remarkComponentProps, { getWaypoints: () => waypoints }],
      ],
    });
    return null;
  } catch (e) {
    const err = e as Error & { line?: number; place?: { line?: number; start?: { line?: number } } };
    const line = err.line ?? err.place?.start?.line ?? err.place?.line;
    return `${line ? `line ${line}: ` : ""}${err.message}`;
  }
}
