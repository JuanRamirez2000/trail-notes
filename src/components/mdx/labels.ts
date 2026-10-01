import type { HikeWaypoint } from "@/lib/hike";

const KIND: Record<HikeWaypoint["type"], string> = {
  start: "Trailhead",
  turn: "Turning point",
  note: "Note",
  viewpoint: "Viewpoint",
  water: "Water",
  landmark: "Landmark",
  ranger: "Ranger station",
  bailout: "Bail-out",
};

/** "Turning point · Step 3" / "Water · Spring" */
export function waypointHeading(wp: HikeWaypoint) {
  return wp.stepIndex !== null ? `${KIND[wp.type]} · Step ${wp.stepIndex + 1}` : `${KIND[wp.type]} · ${wp.label}`;
}
