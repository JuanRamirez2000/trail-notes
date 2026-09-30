import "server-only";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { formatIssues, frontmatterSchema, waypointsFileSchema } from "./schemas";

/**
 * Disk access for the local /editor. Everything here refuses to run outside `next dev`:
 * Vercel's filesystem is read-only anyway, but the editor must never be reachable in production.
 */
export const editorEnabled = process.env.NODE_ENV === "development";

const HIKES_DIR = path.join(process.cwd(), "content/hikes");
const SLUG = /^[a-z0-9-]+$/;

function hikeDir(slug: string) {
  // The slug regex is what keeps writes inside content/hikes (no "..", no slashes).
  if (!SLUG.test(slug)) throw new Error(`Invalid slug "${slug}"`);
  return path.join(HIKES_DIR, slug);
}

export async function listHikeFolders() {
  const entries = await readdir(HIKES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && SLUG.test(e.name)).map((e) => e.name).sort();
}

export async function readHikeFiles(slug: string) {
  const dir = hikeDir(slug);
  if (!existsSync(path.join(dir, "index.mdx"))) return null;
  const mdx = await readFile(path.join(dir, "index.mdx"), "utf8");
  const wpPath = path.join(dir, "waypoints.json");
  const waypoints = existsSync(wpPath) ? await readFile(wpPath, "utf8") : '{\n  "waypoints": []\n}\n';
  return { mdx, waypoints };
}

export function splitFrontmatter(source: string) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  return m ? { data: parseYaml(m[1]) as unknown, body: source.slice(m[0].length) } : { data: {}, body: source };
}

/** Validates both files with the same schemas Velite uses. Returns problems as `file: path: message`. */
export function validateHikeFiles(slug: string, mdx: string, waypointsJson: string): string[] {
  const problems: string[] = [];
  try {
    const fm = frontmatterSchema.safeParse(splitFrontmatter(mdx).data);
    if (!fm.success) problems.push(...formatIssues(fm.error).map((m) => `index.mdx: ${m}`));
    else if (fm.data.slug !== slug) problems.push(`index.mdx: slug must be "${slug}" to match the folder`);
  } catch (e) {
    problems.push(`index.mdx: frontmatter YAML: ${(e as Error).message}`);
  }
  try {
    const wp = waypointsFileSchema.safeParse(JSON.parse(waypointsJson));
    if (!wp.success) problems.push(...formatIssues(wp.error).map((m) => `waypoints.json: ${m}`));
  } catch (e) {
    problems.push(`waypoints.json: ${(e as Error).message}`);
  }
  return problems;
}

export async function writeHikeFiles(slug: string, mdx: string, waypointsJson: string) {
  const dir = hikeDir(slug);
  await writeFile(path.join(dir, "index.mdx"), mdx.endsWith("\n") ? mdx : `${mdx}\n`);
  // Re-serialise so hand-typed JSON lands in the same format the ingest script writes.
  await writeFile(path.join(dir, "waypoints.json"), `${JSON.stringify(JSON.parse(waypointsJson), null, 2)}\n`);
}
