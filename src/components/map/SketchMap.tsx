"use client";

import { cn } from "@/lib/cn";
import { Pin } from "@/components/ui/Pin";
import { isSafety } from "@/lib/hike";
import { Cone } from "./Cone";
import type { TrailMapProps } from "./types";

type Box = { w: number; e: number; s: number; n: number };

function boxOf(points: { lat: number; lng: number }[], pad = 0.24): Box {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const dx = Math.max(e - w, 0.004);
  const dy = Math.max(n - s, 0.004);
  return { w: w - dx * pad, e: e + dx * pad, s: s - dy * pad, n: n + dy * pad };
}

export function project(box: Box, p: { lat: number; lng: number }) {
  return { x: ((p.lng - box.w) / (box.e - box.w)) * 100, y: ((box.n - p.lat) / (box.n - box.s)) * 100 };
}

/**
 * Hand-drawn stand-in for the Mapbox map, matching the design's contour sketch.
 * Used while the real map lazy-loads, for tiny thumbnails, and when no token is set.
 */
export function SketchMap({ waypoints, activeId, heading, labels, safety, onSelect, fit = "route", pinSize = 22, className }: TrailMapProps) {
  const active = waypoints.find((w) => w.id === activeId);
  const focus = fit === "active" && active ? [active] : waypoints;
  if (!focus.length) return <div className={cn("bg-contour", className)} />;
  const box = boxOf(fit === "active" && active ? [{ lat: active.lat + 0.002, lng: active.lng + 0.002 }, { lat: active.lat - 0.002, lng: active.lng - 0.002 }] : focus);
  const pts = waypoints.map((w) => ({ w, ...project(box, w) }));

  return (
    <div className={cn("bg-contour relative overflow-hidden", className)} role="img" aria-label="Route sketch">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth={3}
          strokeDasharray="7 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {active && heading != null && (
        <div className="absolute z-[4]" style={{ left: `${project(box, active).x}%`, top: `${project(box, active).y}%` }}>
          <div style={{ transform: `translate(-50%,-50%) rotate(${heading}deg)` }}>
            <Cone size={fit === "active" ? 60 : 92} />
          </div>
        </div>
      )}
      {pts.map(({ w, x, y }) => {
        const dim = safety && !isSafety(w);
        const on = w.id === activeId;
        return (
          <button
            key={w.id}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(w.id)}
            className={cn("absolute -translate-x-1/2 -translate-y-1/2", onSelect && "cursor-pointer", on ? "z-[6]" : isSafety(w) ? "z-[3]" : "z-[2]")}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={w.label}
          >
            <Pin type={w.type} size={pinSize} active={on} dimmed={dim} />
            {labels && !dim && <MapLabel>{w.label}</MapLabel>}
          </button>
        );
      })}
    </div>
  );
}

export function MapLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap border border-line-strong bg-card px-1 text-label font-bold tracking-[.06em] text-graphite uppercase">
      {children}
    </span>
  );
}
