"use client";

import { useMemo } from "react";
import { isSafety } from "@/lib/hike";
import { useHike } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { WaypointLinks, type WaypointLinksProps } from "./WaypointLinks";

type Props = Pick<WaypointLinksProps, "onPick" | "bare" | "className">;

/** Water, bail-outs and ranger stations in route order: what you'd look for if things go wrong. */
export function SafetyList(props: Props) {
  const waypoints = useHike((s) => s.waypoints);
  const safety = useMemo(() => waypoints.filter(isSafety), [waypoints]);
  return (
    <WaypointLinks
      title="Safety points"
      waypoints={safety}
      primary={(wp) => wp.label}
      detail={(wp) => wp.note ?? PIN_STYLES[wp.type].label}
      empty="No water, bail-outs or ranger stations recorded."
      {...props}
    />
  );
}
