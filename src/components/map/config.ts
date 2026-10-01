"use client";

import { useSyncExternalStore } from "react";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const MAPBOX_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/outdoors-v12";
export const hasMapbox = MAPBOX_TOKEN.startsWith("pk.");

/** Resolved token values. The theme is fixed (no dark mode), so each token is read once. */
const resolved = new Map<string, string>();

/**
 * Mapbox paint properties need literal colors, not CSS variables. Resolve a
 * design token from :root at runtime so map layers still follow the theme.
 * Cached: getSnapshot runs on every render, and calling getComputedStyle there forces a style
 * recalculation each time a map re-renders (e.g. on every scrollspy step change).
 */
export function useCssColor(token: `--color-${string}`, fallback = "black"): string {
  return useSyncExternalStore(
    () => () => {},
    () => {
      let value = resolved.get(token);
      if (value === undefined) {
        value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
        if (value) resolved.set(token, value);
      }
      return value || fallback;
    },
    () => fallback,
  );
}
