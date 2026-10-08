"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { hasMapbox } from "@/components/map/config";
import { cn } from "@/lib/cn";
import { SketchHikesMap } from "./SketchHikesMap";
import type { HikesMapProps } from "./types";

const MapboxHikesMap = dynamic(() => import("./MapboxHikesMap"), { ssr: false });

/** Sketch underneath until Mapbox paints; if Mapbox can't start (no WebGL), the sketch stays. */
export function HikesMap(props: HikesMapProps) {
  const [status, setStatus] = useState<"idle" | "loaded" | "failed">("idle");
  const useMapbox = hasMapbox && status !== "failed";
  return (
    <>
      {status !== "loaded" && <SketchHikesMap {...props} />}
      {useMapbox && (
        <MapboxHikesMap
          {...props}
          onLoad={() => setStatus("loaded")}
          onFail={() => setStatus("failed")}
          // Hidden until it has painted, like TrailMap: otherwise its pins show on top of the sketch's.
          className={cn(props.className, status !== "loaded" && "invisible")}
        />
      )}
    </>
  );
}
