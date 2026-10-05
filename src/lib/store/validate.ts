import { parse as parseYaml } from "yaml";
import { checkMdx } from "../mdx/check";
import { FRONTMATTER } from "../mdx/plugins";
import { formatIssues, frontmatterSchema, waypointsFileSchema, type Frontmatter, type WaypointsFile } from "../schemas";

/** Size limits for one save. Generous for a guide, small enough that a request can't be abused. */
export const MAX_MDX_BYTES = 200_000;
export const MAX_WAYPOINTS_BYTES = 500_000;

export const SLUG = /^[a-z0-9-]+$/;

export function splitFrontmatter(source: string): { data: unknown; body: string } {
  const m = FRONTMATTER.exec(source);
  return m ? { data: parseYaml(m[1]) as unknown, body: source.slice(m[0].length) } : { data: {}, body: source };
}

export type Validated =
  | {
      ok: true;
      details: Frontmatter;
      /** The pins exactly as written (validated, but not rewritten with schema defaults or key order). */
      waypoints: unknown;
      mdx: string;
    }
  | { ok: false; problems: string[] };

/**
 * The one gate every write passes, whatever the backend: the shared schemas (guide details and
 * pins), then the MDX compiled with the same passes that render the page. Problems come back as
 * `file: message`, the way the editor shows them.
 */
export async function validateHike(slug: string, mdx: string, waypointsJson: string): Promise<Validated> {
  const problems: string[] = [];
  if (!SLUG.test(slug)) return { ok: false, problems: [`slug "${slug}" must be lowercase letters, digits and dashes`] };
  if (Buffer.byteLength(mdx) > MAX_MDX_BYTES) problems.push(`index.mdx: larger than ${MAX_MDX_BYTES / 1000} kB`);
  if (Buffer.byteLength(waypointsJson) > MAX_WAYPOINTS_BYTES) problems.push(`waypoints.json: larger than ${MAX_WAYPOINTS_BYTES / 1000} kB`);
  if (problems.length) return { ok: false, problems };

  let details: Frontmatter | undefined;
  try {
    const fm = frontmatterSchema.safeParse(splitFrontmatter(mdx).data);
    if (!fm.success) problems.push(...formatIssues(fm.error).map((m) => `index.mdx: ${m}`));
    else if (fm.data.slug !== slug) problems.push(`index.mdx: slug must be "${slug}"`);
    else details = fm.data;
  } catch (e) {
    problems.push(`index.mdx: frontmatter YAML: ${(e as Error).message}`);
  }

  let waypoints: WaypointsFile | undefined;
  let written: unknown;
  try {
    written = JSON.parse(waypointsJson);
    const wp = waypointsFileSchema.safeParse(written);
    if (!wp.success) problems.push(...formatIssues(wp.error).map((m) => `waypoints.json: ${m}`));
    else waypoints = wp.data;
  } catch (e) {
    problems.push(`waypoints.json: ${(e as Error).message}`);
  }

  const mdxProblem = await checkMdx(mdx, waypoints?.waypoints ?? null);
  if (mdxProblem) problems.push(`index.mdx: ${mdxProblem}`);

  if (problems.length || !details || !waypoints) return { ok: false, problems };
  return { ok: true, details, waypoints: written, mdx: mdx.endsWith("\n") ? mdx : `${mdx}\n` };
}

/** `draft: true|false` in the frontmatter, rewritten in place (added before the closing `---` if absent). */
export function setDraftFlag(mdx: string, draft: boolean): string {
  const m = FRONTMATTER.exec(mdx);
  if (!m) return mdx;
  const yaml = m[1];
  const next = /^draft:.*$/m.test(yaml) ? yaml.replace(/^draft:.*$/m, `draft: ${draft}`) : `${yaml}\ndraft: ${draft}`;
  return mdx.replace(yaml, next);
}

/** Pins as the house JSON text. */
export const waypointsText = (waypoints: unknown) => `${JSON.stringify(waypoints, null, 2)}\n`;
