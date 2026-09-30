"use client";

import dynamic from "next/dynamic";
import { hasMapbox } from "@/components/map/config";
import { SketchHikesMap } from "./SketchHikesMap";
import type { HikesMapProps } from "./types";

const MapboxHikesMap = dynamic(() => import("./MapboxHikesMap"), {
  ssr: false,
  loading: () => <div className="bg-contour absolute inset-0" />,
});

export function HikesMap(props: HikesMapProps) {
  return hasMapbox ? <MapboxHikesMap {...props} /> : <SketchHikesMap {...props} />;
}
