import { evaluate } from "@mdx-js/mdx";
import type { MDXContent } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import { parse as parseYaml } from "yaml";
import { deriveWaypoints, type HikeWaypoint } from "@/lib/hike";
import { remarkComponentProps } from "@/lib/mdx/remark-component-props";
import { remarkDefaultBlocks } from "@/lib/mdx/remark-default-blocks";
import { remarkStepSections } from "@/lib/mdx/remark-step-sections";
import { formatIssues, waypointsFileSchema, type Track } from "@/lib/schemas";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export type CompiledPreview =
  | { ok: true; Content: MDXContent; frontmatter: Record<string, unknown> }
  | { ok: false; error: string };

/** Browser-side MDX compile for the live preview (production pages use Velite's build-time output). */
export async function compilePreview(source: string, waypoints: HikeWaypoint[] | null): Promise<CompiledPreview> {
  try {
    const m = FRONTMATTER.exec(source);
    const frontmatter = m ? ((parseYaml(m[1]) ?? {}) as Record<string, unknown>) : {};
    const body = m ? source.slice(m[0].length) : source;
    // Same stub-section pass as the Velite build, fed the editor's in-memory waypoints.
    const { default: Content } = await evaluate(body, {
      ...runtime,
      development: false,
      remarkPlugins: [
        [remarkStepSections, { getWaypoints: () => waypoints }],
        remarkDefaultBlocks,
        [remarkComponentProps, { getWaypoints: () => waypoints }],
      ],
    });
    return { ok: true, Content, frontmatter };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Parses the editor's waypoints.json text. With the hike's track, mileage is measured along it, as on the live page. */
export function parseWaypoints(text: string, track?: Track | null): { ok: true; waypoints: HikeWaypoint[] } | { ok: false; error: string } {
  try {
    const parsed = waypointsFileSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, error: formatIssues(parsed.error).join("\n") };
    return { ok: true, waypoints: deriveWaypoints(parsed.data.waypoints, track) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function countComponents(source: string, names: string[]) {
  return (source.match(new RegExp(`<(${names.join("|")})\\b`, "g")) ?? []).length;
}

export function countWords(source: string) {
  return source.replace(FRONTMATTER, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}
