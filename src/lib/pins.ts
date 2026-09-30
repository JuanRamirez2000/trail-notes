import type { WaypointType } from "./schemas";

/**
 * Pin language from the brand sheet. Navigation pins (start/turn/viewpoint) are flat;
 * safety pins (water/bail-out) are larger with a double halo — never reuse that for other pins.
 */
export type PinStyle = {
  label: string;
  glyph: string;
  color: string;
  radius: string;
  safety: boolean;
};

export const PIN_STYLES: Record<WaypointType, PinStyle> = {
  start: { label: "Trailhead", glyph: "S", color: "var(--color-pin-start)", radius: "50%", safety: false },
  turn: { label: "Turn", glyph: "↰", color: "var(--color-pin-turn)", radius: "50%", safety: false },
  viewpoint: { label: "Viewpoint", glyph: "◎", color: "var(--color-pin-viewpoint)", radius: "5px", safety: false },
  water: { label: "Water", glyph: "W", color: "var(--color-pin-water)", radius: "50%", safety: true },
  bailout: { label: "Bail-out", glyph: "!", color: "var(--color-pin-bailout)", radius: "4px", safety: true },
};

export const LEGEND_ORDER: WaypointType[] = ["start", "turn", "viewpoint", "water", "bailout"];
