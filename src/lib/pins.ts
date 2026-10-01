import type { WaypointType } from "./schemas";

/**
 * How a pin type relates to the written guide:
 *  - "required": a guide section. Numbered in the step list; if the post has no
 *    <Step> block for it, a stub section is generated in route order.
 *  - "optional": may have a <Step> section, but never numbered or auto-generated.
 */
export type SectionKind = "required" | "optional";

/**
 * Pin language from the brand sheet. Navigation pins are flat; safety pins (water/bail-out)
 * are larger with a double halo, and that style is never reused for other pins.
 */
export type PinStyle = {
  label: string;
  glyph: string;
  color: string;
  radius: string;
  safety: boolean;
  section: SectionKind;
};

export const PIN_STYLES: Record<WaypointType, PinStyle> = {
  start: { label: "Trailhead", glyph: "S", color: "var(--color-pin-start)", radius: "50%", safety: false, section: "required" },
  turn: { label: "Turn", glyph: "↰", color: "var(--color-pin-turn)", radius: "50%", safety: false, section: "required" },
  // Flex note: a guide section for anything that isn't a turn (scree, slick bridge, no signal…).
  note: { label: "Note", glyph: "✎", color: "var(--color-pin-note)", radius: "50%", safety: false, section: "required" },
  bailout: { label: "Bail-out", glyph: "!", color: "var(--color-pin-bailout)", radius: "4px", safety: true, section: "required" },
  viewpoint: { label: "Viewpoint", glyph: "◎", color: "var(--color-pin-viewpoint)", radius: "5px", safety: false, section: "optional" },
  water: { label: "Water", glyph: "W", color: "var(--color-pin-water)", radius: "50%", safety: true, section: "optional" },
};

export const LEGEND_ORDER: WaypointType[] = ["start", "turn", "note", "viewpoint", "water", "bailout"];

export const requiresSection = (type: WaypointType) => PIN_STYLES[type].section === "required";
