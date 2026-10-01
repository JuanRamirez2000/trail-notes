"use client";

import { cn } from "@/lib/cn";
import dynamic from "next/dynamic";
import { useState } from "react";
import { hasMapbox } from "./config";
import { SketchMap } from "./SketchMap";
import type { TrailMapProps } from "./types";
import { useNearViewport } from "./useInView";

// mapbox-gl touches `window` and is ~1MB, so it only loads client-side, in its own chunk.
const MapboxTrailMap = dynamic(() => import("./MapboxTrailMap"), { ssr: false });

/**
 * Route map used by every map-based component. The sketch is always the base layer; Mapbox
 * mounts on top only while near the viewport (each load is billable and holds a WebGL context)
 * and the sketch is dropped once it has painted. If Mapbox fails (e.g. no WebGL), the sketch stays.
 */
export function TrailMap({ className, ...props }: TrailMapProps) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const [status, setStatus] = useState<"idle" | "loaded" | "failed">("idle");
  const showMapbox = hasMapbox && near && status !== "failed";
  // Sketch is visible unless a mounted Mapbox map has painted (it comes back when the map
  // scrolls away and unmounts).
  const painted = showMapbox && status === "loaded";

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      {!painted && <SketchMap {...props} className="absolute inset-0" />}
      {showMapbox && (
        <MapboxTrailMap
          {...props}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className="absolute inset-0"
        />
      )}
    </div>
  );
}
