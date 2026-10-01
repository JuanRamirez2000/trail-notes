"use client";

import { useState } from "react";
import { SketchMap } from "@/components/map/SketchMap";
import { TrailMap } from "@/components/map/TrailMap";
import { SafetyList } from "@/components/sidebar/SafetyList";
import { StepList } from "@/components/sidebar/StepList";
import { Frame } from "@/components/ui/Frame";
import { cn } from "@/lib/cn";
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

/** Small map that follows the current step. Pins and prev/next jump the guide to that section. */
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
          <button type="button" onClick={() => stepBy(-1, { reveal: true })} className="cursor-pointer">◀ Prev</button>
          <span className="truncate">{active?.label ?? "—"}</span>
          <button type="button" onClick={() => stepBy(1, { reveal: true })} className="cursor-pointer">Next ▶</button>
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

/** Mobile/tablet: collapsed bar pinned to the top; expands to the map plus the step list. */
export function MinimapBar() {
  const { waypoints, steps, select, active, heading, stepNo } = useMinimapState();
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-card lg:hidden">
      {open && (
        <>
          <div className="relative h-[210px]">
            <TrailMap
              waypoints={waypoints}
              activeId={active?.id}
              heading={heading}
              onSelect={(id) => {
                setOpen(false);
                requestAnimationFrame(() => select(id, { reveal: true }));
              }}
              className="size-full"
            />
          </div>
          {/* Same stack as the desktop rail: map, safety points, steps. */}
          <div className="max-h-[50dvh] overflow-y-auto border-t border-line">
            <BarHeading>Safety points</BarHeading>
            <SafetyList bare onPick={() => setOpen(false)} />
            <BarHeading>Steps</BarHeading>
            <StepList bare onPick={() => setOpen(false)} />
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-t border-line px-4 py-1.5 text-left first:border-t-0"
      >
        {!open && <SketchMap waypoints={waypoints} activeId={active?.id} pinSize={10} className="h-11 w-14 flex-none rounded-md border border-line" />}
        <span className="flex-1 leading-tight">
          {open ? "Close" : "Map, safety & steps"}
          <br />
          <span className="text-caption text-bark">
            {stepNo ? `Step ${stepNo} of ${steps.length} · ` : ""}
            {active?.label}
          </span>
        </span>
        <span className={cn("px-1 text-lg transition-transform", open && "rotate-180")} aria-hidden>
          ▾
        </span>
      </button>
    </div>
  );
}

function BarHeading({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 border-b border-line bg-frame px-3 py-1 text-caption font-semibold tracking-[.06em] text-bark uppercase">{children}</div>;
}
