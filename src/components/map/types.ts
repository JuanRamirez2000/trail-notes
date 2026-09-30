import type { HikeWaypoint } from "@/lib/hike";

export type TrailMapProps = {
  waypoints: HikeWaypoint[];
  activeId?: string | null;
  /** Draw the view cone at the active waypoint. */
  heading?: number | null;
  labels?: boolean;
  /** Emphasise safety pins and fade the rest (SafetyPins). */
  safety?: boolean;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  /** 3D terrain + tilt. Keep off for small maps: it costs a DEM tile load per map. */
  terrain?: boolean;
  /** "route" fits the whole hike; "active" zooms close on the active waypoint (360° inset). */
  fit?: "route" | "active";
  /** Pin size in px (sketch only); thumbnails use small pins. */
  pinSize?: number;
  className?: string;
};
