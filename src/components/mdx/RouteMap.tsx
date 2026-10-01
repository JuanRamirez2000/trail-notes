"use client";

import { TrailMap } from "@/components/map/TrailMap";
import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { useHike } from "@/lib/hike-store";
import { LEGEND_ORDER, PIN_STYLES } from "@/lib/pins";

export type RouteMapProps = {
  /** Map height in px. */
  height?: number;
  labels?: boolean;
  /** 3D terrain with tilt. */
  terrain?: boolean;
};

export function RouteMap({ height = 320, labels = true, terrain = true }: RouteMapProps) {
  const waypoints = useHike((s) => s.waypoints);
  const route = useHike((s) => s.route);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const present = new Set(waypoints.map((w) => w.type));

  return (
    <Frame
      title="Route map"
      footer={
        <div className="flex flex-wrap items-center gap-4">
          {LEGEND_ORDER.filter((t) => present.has(t)).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Pin type={t} size={18} className="m-[3px]" />
              {PIN_STYLES[t].label}
            </span>
          ))}
        </div>
      }
    >
      <div data-map style={{ height }}>
        <TrailMap
          route={route}
          waypoints={waypoints}
          activeId={activeId}
          labels={labels}
          terrain={terrain}
          onSelect={(id) => select(id, { reveal: true })}
          className="h-full"
        />
      </div>
    </Frame>
  );
}
