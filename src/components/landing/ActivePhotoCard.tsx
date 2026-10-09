"use client";

import { PhotoCard } from "@/components/mdx/PhotoCard";
import { useHike } from "@/lib/hike-store";

/**
 * The photo card of whichever pin is selected, so picking a pin on any of the landing page's maps
 * changes the photo. A guide places its cards on fixed pins; this is the one block here that isn't
 * used as a guide uses it. A selected pin without a photo falls back to the first one that has one.
 */
export function ActivePhotoCard() {
  const id = useHike((s) => (s.waypoints.find((w) => w.id === s.activeId && w.photo) ?? s.waypoints.find((w) => w.photo))?.id);
  return id ? <PhotoCard waypoint={id} /> : null;
}
