"use client";

import { useEffect, useRef } from "react";
import { useHike } from "@/lib/hike-store";

/** Scrolls the element into view when a map pin for `waypointId` is clicked with reveal. */
export function useReveal<T extends HTMLElement>(waypointId: string | undefined) {
  const ref = useRef<T>(null);
  const reveal = useHike((s) => s.reveal);
  useEffect(() => {
    if (reveal && reveal.id === waypointId) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reveal, waypointId]);
  return ref;
}
