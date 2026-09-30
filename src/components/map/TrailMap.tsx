"use client";

import { cn } from "@/lib/cn";
import dynamic from "next/dynamic";
import { hasMapbox } from "./config";
import { SketchMap } from "./SketchMap";
import type { TrailMapProps } from "./types";
import { useInViewOnce } from "./useInView";

// mapbox-gl touches `window` and is ~1MB, so it only loads client-side, in its own chunk.
const MapboxTrailMap = dynamic(() => import("./MapboxTrailMap"), { ssr: false });

/**
 * Route map used by every map-based component. Renders the sketch until the map
 * scrolls near the viewport (each Mapbox map load is billable), then swaps in Mapbox.
 */
export function TrailMap({ className, ...props }: TrailMapProps) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <SketchMap {...props} className="absolute inset-0" />
      {hasMapbox && inView && <MapboxTrailMap {...props} className="absolute inset-0" />}
    </div>
  );
}
