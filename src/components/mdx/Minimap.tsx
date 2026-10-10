"use client";

import { useState } from "react";
import { SketchMap } from "@/components/map/SketchMap";
import { TrailMap } from "@/components/map/TrailMap";
import { SafetyList } from "@/components/sidebar/SafetyList";
import { StepList } from "@/components/sidebar/StepList";
import { floatingButton } from "@/components/ui/Frame";
import { cn } from "@/lib/cn";
import { SIDEBAR_CARDS, type SidebarCardId } from "@/lib/schemas";
import { useActiveWaypoint, useEffectiveHeading, useHike } from "@/lib/hike-store";
import type { ManifestProps } from "@/lib/mdx/manifest";

/** Props are defined in lib/mdx/manifest.ts. */
export type MinimapProps = ManifestProps<"Minimap">;

function useMinimapState() {
  const waypoints = useHike((s) => s.waypoints);
  const route = useHike((s) => s.route);
  const steps = useHike((s) => s.steps);
  const select = useHike((s) => s.select);
  const stepBy = useHike((s) => s.stepBy);
  const active = useActiveWaypoint();
  const heading = useEffectiveHeading(active);
  const stepNo = active?.stepIndex != null ? active.stepIndex + 1 : null;
  return { waypoints, route, steps, select, stepBy, active, heading, stepNo };
}

/**
 * The small map that follows the current step (design: Trailnotes Components, "Minimap"): a card
 * with the map and one line under it (previous, "3/5 Ridge junction", next), which shrinks to a
 * round chip of the current spot when the reader wants the room. Pins and the arrows move the
 * guide to that section.
 */
export function Minimap({ height = 300 }: MinimapProps) {
  const { waypoints, route, steps, select, stepBy, active, heading, stepNo } = useMinimapState();
  const [collapsed, setCollapsed] = useState(false);
  const where = `${stepNo ? `step ${stepNo} of ${steps.length}, ` : ""}${active?.label ?? "the route"}`;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={`Show the map (${where})`}
        title="Show the map"
        className="not-prose ml-auto block size-14 flex-none cursor-pointer overflow-hidden rounded-full border-[3px] border-white shadow-[0_0_0_1.5px_var(--color-graphite)]"
      >
        <SketchMap waypoints={waypoints} route={route} activeId={active?.id} fit="active" pinSize={12} className="pointer-events-none size-full" />
      </button>
    );
  }

  return (
    <section aria-label="Minimap" className="not-prose overflow-hidden rounded-[10px] border border-line-strong bg-card shadow-[0_4px_14px_rgb(31_36_33/0.12)]">
      <div className="relative" style={{ height }}>
        <TrailMap route={route} waypoints={waypoints} activeId={active?.id} heading={heading} controls="top-left" onSelect={(id) => select(id, { reveal: true })} className="size-full" />
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Shrink the map to a chip" title="Shrink the map" className={cn(floatingButton, "absolute top-2 right-2 size-7")}>
          ▾
        </button>
      </div>
      <div className="flex items-center gap-1.5 border-t border-line px-1 py-0.5 text-sm">
        <button type="button" onClick={() => stepBy(-1, { reveal: true })} aria-label="Previous step" className="size-8 flex-none cursor-pointer text-bark hover:text-graphite">
          ◀
        </button>
        <span className="min-w-0 flex-1 truncate text-center leading-tight" aria-live="polite">
          {stepNo && (
            <b>
              {stepNo}/{steps.length}{" "}
            </b>
          )}
          {active?.label ?? "—"}
        </span>
        <button type="button" onClick={() => stepBy(1, { reveal: true })} aria-label="Next step" className="size-8 flex-none cursor-pointer text-bark hover:text-graphite">
          ▶
        </button>
      </div>
    </section>
  );
}

/** Mobile/tablet: collapsed bar pinned to the top; expands to the guide's sidebar cards (map, safety points, steps). */
export function MinimapBar({ cards = [...SIDEBAR_CARDS] }: { cards?: SidebarCardId[] }) {
  const { waypoints, route, steps, select, active, heading, stepNo } = useMinimapState();
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-card lg:hidden">
      {open && (
        <>
          {cards.includes("minimap") && (
            <div className="relative h-[210px]">
              <TrailMap
                route={route}
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
          )}
          {/* Same cards and order as the desktop rail. */}
          <div className="max-h-[50dvh] overflow-y-auto border-t border-line">
            {cards.map((id) =>
              id === "safety" ? (
                <div key={id}>
                  <BarHeading>Safety points</BarHeading>
                  <SafetyList bare onPick={() => setOpen(false)} />
                </div>
              ) : id === "steps" ? (
                <div key={id}>
                  <BarHeading>Steps</BarHeading>
                  <StepList bare onPick={() => setOpen(false)} />
                </div>
              ) : null,
            )}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-t border-line px-4 py-1.5 text-left first:border-t-0"
      >
        {!open && <SketchMap waypoints={waypoints} route={route} activeId={active?.id} pinSize={10} className="h-11 w-14 flex-none rounded-md border border-line" />}
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
