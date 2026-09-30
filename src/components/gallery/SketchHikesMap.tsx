"use client";

import { cn } from "@/lib/cn";
import { project } from "@/components/map/SketchMap";
import { HikePin } from "./HikePin";
import { HikePopup } from "./HikePopup";
import type { HikesMapProps } from "./types";

export function SketchHikesMap({ hikes, selected, onSelect, className }: HikesMapProps) {
  const pts = hikes.map((h) => h.trailhead);
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const pad = 0.5;
  const box = pts.length
    ? { w: Math.min(...lngs) - pad, e: Math.max(...lngs) + pad, s: Math.min(...lats) - pad, n: Math.max(...lats) + pad }
    : { w: 0, e: 1, s: 0, n: 1 };
  const sel = hikes.find((h) => h.slug === selected);

  return (
    <div className={cn("bg-contour relative overflow-hidden", className)} onClick={() => onSelect(null)}>
      {hikes.map((h, i) => {
        const { x, y } = project(box, h.trailhead);
        return (
          <button
            key={h.slug}
            type="button"
            className={cn("absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer", h.slug === selected ? "z-10" : "z-[1]")}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(h.slug);
            }}
            aria-label={h.title}
          >
            <HikePin n={i + 1} selected={h.slug === selected} />
          </button>
        );
      })}
      {sel && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+22px)] overflow-hidden rounded-lg border border-line bg-card shadow-sketch"
          style={{ left: `${project(box, sel.trailhead).x}%`, top: `${project(box, sel.trailhead).y}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <HikePopup hike={sel} />
        </div>
      )}
    </div>
  );
}
