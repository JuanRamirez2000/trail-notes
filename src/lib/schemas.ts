import { z } from "zod";

/**
 * Single source of truth for content shape. Used by:
 *  - velite.config.ts (build-time validation of content/)
 *  - scripts/ingest-photos.ts (draft waypoint generation)
 *  - /api/editor (validation before writing to disk)
 */

export const DIFFICULTIES = ["easy", "moderate", "hard", "strenuous"] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

export const WAYPOINT_TYPES = ["start", "turn", "note", "viewpoint", "landmark", "water", "ranger", "bailout"] as const;
export const waypointTypeSchema = z.enum(WAYPOINT_TYPES);
export type WaypointType = z.infer<typeof waypointTypeSchema>;

export const lngLatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LngLat = z.infer<typeof lngLatSchema>;

/** Storage key, not a URL: `<slug>/<name>`. Resolved by lib/storage. */
const photoKey = z
  .string()
  .regex(/^[a-z0-9-]+\/[a-z0-9._-]+$/, "photo key must look like '<slug>/<name>'");

export const photoSchema = z.object({
  key: photoKey,
  /** "pano" = full 2:1 equirectangular 360° image. */
  kind: z.enum(["flat", "pano"]).default("flat"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
});
export type Photo = z.infer<typeof photoSchema>;

export const waypointSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  order: z.number().int().nonnegative(),
  type: waypointTypeSchema,
  /** Short map label, e.g. "Ridge junction". */
  label: z.string().min(1),
  /** Step instruction, e.g. "Stay left toward the ridge". */
  title: z.string().min(1),
  caption: z.string().optional(),
  /** Extra detail for safety pins, e.g. "seasonal, filter water". */
  note: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Compass bearing the photo faces (0 = north). For panos: bearing of the image centre. */
  heading: z.number().min(0).lt(360).nullable().default(null),
  headingSource: z.enum(["exif", "inferred", "manual"]).nullable().default(null),
  /** Override for trail mileage; otherwise estimated from straight-line segments. */
  mile: z.number().nonnegative().optional(),
  photo: photoSchema.optional(),
  takenAt: z.iso.datetime({ offset: true }).optional(),
});
export type Waypoint = z.infer<typeof waypointSchema>;

export const waypointsFileSchema = z
  .object({ waypoints: z.array(waypointSchema) })
  .superRefine(({ waypoints }, ctx) => {
    const seen = new Set<string>();
    for (const [i, wp] of waypoints.entries()) {
      if (seen.has(wp.id)) {
        ctx.addIssue({ code: "custom", path: ["waypoints", i, "id"], message: `duplicate id "${wp.id}"` });
      }
      seen.add(wp.id);
    }
  });
export type WaypointsFile = z.infer<typeof waypointsFileSchema>;

/** Practical info shown in the guide's "Before you go" card. Every field is optional. */
export const essentialsSchema = z.object({
  permit: z.string().optional(),
  parking: z.string().optional(),
  facilities: z.string().optional(),
  water: z.string().optional(),
  dogs: z.string().optional(),
  cellSignal: z.string().optional(),
  hazards: z.array(z.string()).optional(),
});
export type Essentials = z.infer<typeof essentialsSchema>;

export const frontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string().min(1),
  summary: z.string().min(1),
  distanceMi: z.number().positive(),
  elevationGainFt: z.number().nonnegative(),
  difficulty: difficultySchema,
  estTime: z.string().optional(),
  bestSeason: z.string().optional(),
  /** Photo key for the cover image. */
  cover: photoKey,
  trailhead: lngLatSchema,
  date: z.iso.date(),
  draft: z.boolean().default(false),
  essentials: essentialsSchema.optional(),
});
export type Frontmatter = z.infer<typeof frontmatterSchema>;

/** Formats zod issues as `path: message` lines for CLI / editor output. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
