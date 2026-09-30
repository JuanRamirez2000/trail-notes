"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";
import { SketchMap } from "@/components/map/SketchMap";
import { TrailMap } from "@/components/map/TrailMap";
import { Frame } from "@/components/ui/Frame";
import { useActiveWaypoint, useEffectiveHeading, useHike } from "@/lib/hike-store";

export type MinimapProps = { height?: number };

function useMinimapState() {
  const waypoints = useHike((s) => s.waypoints);
  const steps = useHike((s) => s.steps);
  const select = useHike((s) => s.select);
  const stepBy = useHike((s) => s.stepBy);
  const active = useActiveWaypoint();
  const heading = useEffectiveHeading(active);
  const stepNo = active?.stepIndex != null ? active.stepIndex + 1 : null;
  return { waypoints, steps, select, stepBy, active, heading, stepNo };
}

/** Small map that follows the current step. Sticky in the desktop rail. */
export function Minimap({ height = 300 }: MinimapProps) {
  const { waypoints, steps, select, stepBy, active, heading, stepNo } = useMinimapState();
  return (
    <Frame
      title="Minimap"
      actions={stepNo && <span className="text-sm">Step {stepNo} of {steps.length}</span>}
      expandable={false}
      className="my-0"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => stepBy(-1)} className="cursor-pointer">◀ Prev</button>
          <span className="truncate">{active?.label ?? "—"}</span>
          <button type="button" onClick={() => stepBy(1)} className="cursor-pointer">Next ▶</button>
        </div>
      }
    >
      <div style={{ height }}>
        <TrailMap
          waypoints={waypoints}
          activeId={active?.id}
          heading={heading}
          onSelect={(id) => select(id, { reveal: true })}
          className="size-full"
        />
      </div>
    </Frame>
  );
}

/** Mobile: collapsed bar pinned under the header; expands to a 210px map. */
export function MinimapBar() {
  const { waypoints, steps, select, stepBy, active, heading, stepNo } = useMinimapState();
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-card lg:hidden">
      {open && (
        <div className="relative h-[210px]">
          <TrailMap waypoints={waypoints} activeId={active?.id} heading={heading} onSelect={(id) => select(id, { reveal: true })} className="size-full" />
        </div>
      )}
      <div className="flex min-h-11 items-center gap-2.5 px-4 py-1.5">
        {!open && (
          <SketchMap waypoints={waypoints} activeId={active?.id} pinSize={10} className="h-11 w-14 flex-none rounded-md border border-line" />
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-1 cursor-pointer items-center gap-2 text-left" aria-expanded={open}>
          <span className="flex-1 leading-tight">
            Minimap
            <br />
            <span className="text-caption text-bark">
              {stepNo ? `Step ${stepNo} of ${steps.length} · ` : ""}
              {active?.label}
            </span>
          </span>
        </button>
        {open && (
          <span className="flex gap-3 text-sm">
            <button type="button" onClick={() => stepBy(-1)} className="cursor-pointer px-1" aria-label="Previous step">◀</button>
            <button type="button" onClick={() => stepBy(1)} className="cursor-pointer px-1" aria-label="Next step">▶</button>
          </span>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} className={cn("cursor-pointer px-1 text-lg transition-transform", open && "rotate-180")} aria-label={open ? "Collapse minimap" : "Expand minimap"}>
          ▾
        </button>
      </div>
    </div>
  );
}
