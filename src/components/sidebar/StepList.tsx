"use client";

import { useHike } from "@/lib/hike-store";
import { WaypointLinks, type WaypointLinksProps } from "./WaypointLinks";

type Props = Pick<WaypointLinksProps, "onPick" | "bare" | "className">;

/** Quick links to every required guide section, numbered in route order. */
export function StepList(props: Props) {
  const steps = useHike((s) => s.steps);
  return <WaypointLinks title="Steps" waypoints={steps} {...props} />;
}
