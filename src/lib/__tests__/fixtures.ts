import type { Waypoint, WaypointType } from "../schemas";

/** Minimal valid waypoint; lat/lng step north with `order` so mileage is monotonic. */
export function wp(id: string, order: number, type: WaypointType = "turn", extra: Partial<Waypoint> = {}): Waypoint {
  return {
    id,
    order,
    type,
    label: id,
    title: id,
    lat: 34 + order / 10_000,
    lng: -118,
    heading: null,
    headingSource: null,
    ...extra,
  };
}
