import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineCollection, defineConfig, s, z as vz } from "velite";
import { remarkStepSections } from "./src/lib/mdx/remark-step-sections";
import { frontmatterSchema, formatIssues, waypointsFileSchema } from "./src/lib/schemas";

/**
 * Velite ships its own (zod v3) `s`, but our domain schemas live in zod v4 so the
 * ingest script and editor can share them. We let Velite handle the file-level
 * bits (path, MDX compile) and delegate field validation to the shared schemas.
 * The transform's return type is what ends up in `#site/content` typings.
 */

// s.path() yields "hikes/<slug>" for index.mdx and "hikes/<slug>/waypoints" for the JSON.
const slugFromPath = (path: string) => path.replace(/\/(index|waypoints)$/, "").split("/").at(-1)!;

const hikes = defineCollection({
  name: "Hike",
  pattern: "hikes/*/index.mdx",
  schema: s
    .object({ path: s.path(), body: s.mdx() })
    .passthrough()
    .transform(({ path, body, ...fm }, { addIssue }) => {
      const parsed = frontmatterSchema.safeParse(fm);
      if (!parsed.success) {
        for (const msg of formatIssues(parsed.error)) addIssue({ code: "custom", message: msg });
        return vz.NEVER;
      }
      if (parsed.data.slug !== slugFromPath(path)) {
        addIssue({ code: "custom", message: `slug "${parsed.data.slug}" must match folder "${slugFromPath(path)}"` });
        return vz.NEVER;
      }
      return { ...parsed.data, body };
    }),
});

const waypoints = defineCollection({
  name: "WaypointSet",
  pattern: "hikes/*/waypoints.json",
  schema: s
    .object({ path: s.path() })
    .passthrough()
    .transform(({ path, ...data }, { addIssue }) => {
      const parsed = waypointsFileSchema.safeParse(data);
      if (!parsed.success) {
        for (const msg of formatIssues(parsed.error)) addIssue({ code: "custom", message: msg });
        return vz.NEVER;
      }
      return {
        hike: slugFromPath(path),
        waypoints: [...parsed.data.waypoints].sort((a, b) => a.order - b.order),
      };
    }),
});

/**
 * Waypoints for the post being compiled, read from its sibling waypoints.json. In `next dev`,
 * editing only waypoints.json doesn't recompile the post, so new required waypoints get their
 * stub section once index.mdx is next saved (the /editor saves both).
 */
function siblingWaypoints(file: { path: string }) {
  const p = path.join(path.dirname(file.path), "waypoints.json");
  if (!existsSync(p)) return null;
  const parsed = waypointsFileSchema.safeParse(JSON.parse(readFileSync(p, "utf8")));
  return parsed.success ? parsed.data.waypoints : null; // invalid files are reported by the waypoints collection
}

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    clean: true,
  },
  collections: { hikes, waypoints },
  mdx: {
    remarkPlugins: [[remarkStepSections, { getWaypoints: siblingWaypoints }]],
  },
});
