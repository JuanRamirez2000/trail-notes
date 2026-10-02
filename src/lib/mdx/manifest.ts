import { z } from "zod";

/**
 * What every MDX component accepts: the single definition behind
 *  - build-time prop validation (lib/mdx/remark-component-props.ts, run by Velite and the editor preview)
 *  - the editor's settings forms, insert menu and rich-text blocks (components/editor)
 *  - the components' own prop types (components/mdx/registry.tsx checks they match)
 *
 * Pure data (zod, no React) so the build, scripts and tests can import it cheaply.
 *
 * To add a component: build it, add an entry here, add it to components/mdx/registry.tsx.
 * Prop metadata lands in the JSON Schema the editor reads (`z.toJSONSchema`):
 *  - `.describe()` is the field label
 *  - `.meta({ input: "waypoint" })` makes it a pin picker, and the build checks the id exists
 *  - `.meta({ internal: true })` hides it from the editor (set by the build, e.g. on auto stubs)
 */

/** Id of a waypoint in the hike's waypoints.json. */
export const waypointRef = () => z.string().regex(/^[a-z0-9-]+$/, "must be a waypoint id").meta({ input: "waypoint" });
const internal = () => z.boolean().optional().meta({ internal: true });

export type ComponentCategory = "Guide" | "Maps" | "Photos" | "Trip info";

export type ManifestEntry = {
  title: string;
  description: string;
  category: ComponentCategory;
  /** Props as written in MDX. Objects are strict: unknown props fail the build. */
  props: z.ZodObject;
  /** "markdown": may wrap text, e.g. <Step>…</Step>. "none": always self-closing. */
  children: "none" | "markdown";
  /** Inserted by the editor; `{{waypoint}}` becomes a real waypoint id. */
  snippet: string;
};

export const manifest = {
  Step: {
    title: "Guide section",
    description: "Section for a pin: number, photo, your notes",
    category: "Guide",
    props: z
      .object({
        waypoint: waypointRef().describe("Pin"),
        hidePhoto: z.boolean().optional().describe("Hide the photo"),
        auto: internal(),
      })
      .strict(),
    children: "markdown",
    snippet: '<Step waypoint="{{waypoint}}">\n\nWrite this part of the guide.\n\n</Step>',
  },
  BeforeYouGo: {
    title: "Before you go",
    description: "Permit, parking, water and hazards from the hike's details",
    category: "Trip info",
    props: z.object({ auto: internal() }).strict(),
    children: "none",
    snippet: "<BeforeYouGo />",
  },
  RouteMap: {
    title: "Route map",
    description: "Turn, viewpoint, water and bail-out pins",
    category: "Maps",
    props: z
      .object({
        height: z.number().int().min(160).max(800).default(320).describe("Height (px)"),
        labels: z.boolean().default(true).describe("Pin labels"),
        terrain: z.boolean().default(true).describe("3D terrain"),
      })
      .strict(),
    children: "none",
    snippet: "<RouteMap />",
  },
  SafetyPins: {
    title: "Safety pins",
    description: "Water and bail-out points",
    category: "Maps",
    props: z.object({ height: z.number().int().min(160).max(800).default(240).describe("Height (px)") }).strict(),
    children: "none",
    snippet: "<SafetyPins />",
  },
  Minimap: {
    title: "Minimap",
    description: "Small map showing current step",
    category: "Maps",
    props: z.object({ height: z.number().int().min(160).max(600).default(300).describe("Height (px)") }).strict(),
    children: "none",
    snippet: "<Minimap />",
  },
  SafetyPoints: {
    title: "Safety points",
    description: "List of water, bail-outs and ranger stations (also in the sidebar)",
    category: "Trip info",
    props: z.object({}).strict(),
    children: "none",
    snippet: "<SafetyPoints />",
  },
  Steps: {
    title: "Steps",
    description: "Numbered list of guide sections (also in the sidebar)",
    category: "Guide",
    props: z.object({}).strict(),
    children: "none",
    snippet: "<Steps />",
  },
  StepByStep: {
    title: "Step-by-step list",
    description: "Inline step list with photos",
    category: "Guide",
    props: z.object({ showMeta: z.boolean().default(true).describe("Show pin type and mileage") }).strict(),
    children: "none",
    snippet: "<StepByStep />",
  },
  PhotoCard: {
    title: "Turning-point photo card",
    description: "Photo, caption, link to map",
    category: "Photos",
    props: z
      .object({
        waypoint: waypointRef().describe("Pin"),
        caption: z.string().optional().describe("Caption (defaults to the pin's)"),
      })
      .strict(),
    children: "none",
    snippet: '<PhotoCard waypoint="{{waypoint}}" />',
  },
  PanoViewer: {
    title: "360° viewer",
    description: "Pan photo, heading cone on mini map",
    category: "Photos",
    props: z
      .object({
        waypoint: waypointRef().describe("Pin"),
        markerRadiusMi: z.number().min(0).max(10).default(1).describe("Show pins within (mi)"),
      })
      .strict(),
    children: "none",
    snippet: '<PanoViewer waypoint="{{waypoint}}" />',
  },
} satisfies Record<string, ManifestEntry>;

export type ComponentName = keyof typeof manifest;
export const COMPONENT_NAMES = Object.keys(manifest) as ComponentName[];
export const isComponentName = (name: string): name is ComponentName => Object.hasOwn(manifest, name);

/** Props a component receives, as written in MDX (defaults not yet applied). */
export type ManifestProps<K extends ComponentName> = z.input<(typeof manifest)[K]["props"]>;

/** Shown greyed-out in the editor's insert menu. */
export const COMING_LATER = ["Video overlay", "Elevation scrubber", "Sun / shade simulator", "Viewshed map", "GPX export"];

// ── Editor-facing description of a component's props ───────────────────────

export type PropField = {
  name: string;
  label: string;
  kind: "string" | "number" | "integer" | "boolean" | "enum" | "waypoint";
  required: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  options?: string[];
};

type JsonProp = {
  type?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  description?: string;
  input?: string;
  internal?: boolean;
};

/** The editable props of a component, in declaration order, for forms and editor blocks. */
export function propFields(name: ComponentName): PropField[] {
  const schema = z.toJSONSchema(manifest[name].props, { io: "input" }) as { properties?: Record<string, JsonProp>; required?: string[] };
  return Object.entries(schema.properties ?? {})
    .filter(([, p]) => !p.internal)
    .map(([key, p]) => ({
      name: key,
      label: p.description ?? key,
      kind: p.input === "waypoint" ? "waypoint" : p.enum ? "enum" : ((p.type ?? "string") as PropField["kind"]),
      required: schema.required?.includes(key) ?? false,
      default: p.default,
      min: p.minimum,
      max: p.maximum,
      options: p.enum,
    }));
}
