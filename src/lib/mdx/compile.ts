import { compile } from "@mdx-js/mdx";
import type { Waypoint } from "../schemas";
import { blankFrontmatter } from "../frontmatter";
import { guideRemarkPlugins } from "./plugins";

/**
 * Compiles a guide's MDX to the function body that components/mdx/MDXContent.tsx evaluates.
 * Runs on the server when a page is rendered (and the page is cached), never in the browser and
 * never stored: compiled output depends on our code, so it must be rebuilt after a deploy.
 * The same passes as the save gate run here, so content that somehow skipped the gate fails to
 * compile instead of running.
 */
export async function compileGuide(source: string, waypoints: Waypoint[] | null): Promise<string> {
  const file = await compile(blankFrontmatter(source), { outputFormat: "function-body", remarkPlugins: guideRemarkPlugins(waypoints) });
  return String(file);
}
