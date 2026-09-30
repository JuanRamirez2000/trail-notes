/** Shown in place of a component whose `waypoint` prop doesn't match waypoints.json. */
export function MissingWaypoint({ component, id }: { component: string; id?: string }) {
  return (
    <div className="my-[22px] rounded-[10px] border-2 border-dashed border-pin-bailout bg-card p-3 font-mono text-sm text-pin-bailout">
      {`<${component}>`}: no waypoint with id &quot;{id ?? "(missing)"}&quot; in waypoints.json
    </div>
  );
}
