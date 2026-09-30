"use client";

import { useSyncExternalStore } from "react";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const MAPBOX_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/outdoors-v12";
export const hasMapbox = MAPBOX_TOKEN.startsWith("pk.");

/**
 * Mapbox paint properties need literal colors, not CSS variables. Resolve a
 * design token from :root at runtime so map layers still follow the theme.
 */
export function useCssColor(token: `--color-${string}`, fallback = "black"): string {
  return useSyncExternalStore(
    () => () => {},
    () => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback,
    () => fallback,
  );
}
