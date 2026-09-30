import { defineCollection, defineConfig, s, z as vz } from "velite";
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

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    clean: true,
  },
  collections: { hikes, waypoints },
});
