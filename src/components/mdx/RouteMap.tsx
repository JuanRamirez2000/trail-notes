"use client";

import { TrailMap } from "@/components/map/TrailMap";
import { floatingButton, useExpand } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { useHike } from "@/lib/hike-store";
import { LEGEND_ORDER, PIN_STYLES } from "@/lib/pins";
import type { ManifestProps } from "@/lib/mdx/manifest";

/** Props are defined in lib/mdx/manifest.ts. */
export type RouteMapProps = ManifestProps<"RouteMap">;

/**
 * The whole route with every pin (design: Trailnotes Components, "Route map"): the map runs to the
 * block's edges, and everything else floats on it: zoom top left, expand top right, the legend
 * bottom right.
 */
export function RouteMap({ height = 320, labels = true, terrain = true }: RouteMapProps) {
  const waypoints = useHike((s) => s.waypoints);
  const route = useHike((s) => s.route);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const present = new Set(waypoints.map((w) => w.type));
  const { expanded, toggle, backdrop } = useExpand();

  return (
    <>
      {backdrop}
      <section
        aria-label="Route map"
        className={cn("not-prose relative my-[22px] flex scroll-mt-24 flex-col overflow-hidden rounded-[10px] border border-line bg-card", expanded && "fixed inset-3 z-50 my-0 sm:inset-8")}
      >
        <div data-map className={cn(expanded && "min-h-0 flex-1")} style={expanded ? undefined : { height }}>
          <TrailMap route={route} waypoints={waypoints} activeId={activeId} labels={labels} terrain={terrain} controls="top-left" onSelect={(id) => select(id, { reveal: true })} className="size-full" />
        </div>
        <button type="button" onClick={toggle} aria-label={expanded ? "Collapse" : "Expand"} className={cn(floatingButton, "absolute top-2.5 right-2.5 size-[34px] rounded-lg border-line-strong")}>
          {expanded ? "✕" : "⤢"}
        </button>
        {/* Floating on the map where there's room; on a phone it would cover the route, so it sits under the map. */}
        <ul
          aria-label="Pins on this map"
          className="flex flex-wrap gap-x-3.5 gap-y-0.5 border-t border-line bg-card px-2.5 py-2 text-sm sm:absolute sm:right-2.5 sm:bottom-2.5 sm:grid sm:grid-cols-2 sm:rounded-lg sm:border sm:border-line-strong"
        >
          {LEGEND_ORDER.filter((t) => present.has(t)).map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Pin type={t} size={16} className="m-0.5" />
              {PIN_STYLES[t].label}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
