import { z } from "zod";

/**
 * Single source of truth for content shape. Used by the save gate every write passes
 * (lib/store/validate.ts), the public pages, the editor's forms and the scripts.
 */

/** What a hike's address and a pin's id look like: lowercase letters, digits and dashes. */
export const SLUG = /^[a-z0-9-]+$/;
/** Addresses the app uses itself: `/editor/new` is the New hike form. */
export const RESERVED_SLUGS = ["new"];

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
  id: z.string().regex(SLUG, "id must be kebab-case"),
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
  // No capture time: position plus time per pin gives away pace, and timestamps stay private.
  // A stored pin that still has `takenAt` validates, and the field is dropped when it's read.
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
  permit: z.string().optional().describe("Permit"),
  parking: z.string().optional().describe("Parking"),
  facilities: z.string().optional().describe("Facilities"),
  water: z.string().optional().describe("Water"),
  dogs: z.string().optional().describe("Dogs"),
  cellSignal: z.string().optional().describe("Cell signal"),
  hazards: z.array(z.string()).optional().describe("Hazards"),
});
export type Essentials = z.infer<typeof essentialsSchema>;

/** Cards the guide's sidebar can show (components/sidebar/registry.tsx), in the default order. */
export const SIDEBAR_CARDS = ["minimap", "safety", "steps"] as const;
export type SidebarCardId = (typeof SIDEBAR_CARDS)[number];
export const sidebarSchema = z
  .array(z.enum(SIDEBAR_CARDS))
  .refine((cards) => new Set(cards).size === cards.length, "each sidebar card can appear once");

/** `.describe()` is the field's label in the editor's guide details form (components/editor/DetailsForm.tsx). */
export const frontmatterSchema = z.object({
  title: z.string().min(1).describe("Title"),
  slug: z.string().regex(SLUG).describe("Address"),
  region: z.string().min(1).describe("Region"),
  summary: z.string().min(1).describe("Summary"),
  distanceMi: z.number().positive().describe("Distance (mi)"),
  elevationGainFt: z.number().nonnegative().describe("Elevation gain (ft)"),
  difficulty: difficultySchema.describe("Difficulty"),
  estTime: z.string().optional().describe("Estimated time"),
  bestSeason: z.string().optional().describe("Best season"),
  /** Photo key for the cover image. Optional: hikes without photos show a contour placeholder. */
  cover: photoKey.optional().describe("Cover photo"),
  trailhead: lngLatSchema.describe("Trailhead"),
  date: z.iso.date().describe("Date hiked"),
  draft: z.boolean().default(false).describe("Draft"),
  essentials: essentialsSchema.optional().describe("Before you go"),
  /** Sidebar cards for this guide, top to bottom (also the mobile bar's sections). Default: all, in SIDEBAR_CARDS order. */
  sidebar: sidebarSchema.optional().describe("Sidebar"),
});
export type Frontmatter = z.infer<typeof frontmatterSchema>;

/**
 * Recorded route from a GPX file (scripts/import-gpx.ts). Only position + elevation are kept:
 * timestamps, heart rate etc. never leave the original file.
 */
export const trackSchema = z.object({
  /** [lng, lat, elevationMeters] in route order. */
  points: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-1000).max(10000)])).min(2),
  distanceMi: z.number().positive(),
  elevationGainFt: z.number().nonnegative(),
  maxElevationFt: z.number(),
  minElevationFt: z.number(),
});
export type Track = z.infer<typeof trackSchema>;

/** Formats zod issues as `path: message` lines for CLI / editor output. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
