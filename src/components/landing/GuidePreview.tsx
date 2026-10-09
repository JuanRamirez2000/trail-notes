"use client";

import { TrailMap } from "@/components/map/TrailMap";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { formatMiles } from "@/lib/format";
import { useActiveWaypoint, useEffectiveHeading, useHike } from "@/lib/hike-store";

/** How many of the guide's steps fit beside the map. */
const STEPS_SHOWN = 4;

/**
 * The landing page's picture of a guide (design: Trailnotes Landing): a real guide's first steps
 * beside its map, in one card. It's live, not a screenshot: the steps and the map share the
 * guide's selection, so picking either moves the other.
 */
export function GuidePreview({ title, stats }: { title: string; stats: React.ReactNode }) {
  const steps = useHike((s) => s.steps).slice(0, STEPS_SHOWN);
  const waypoints = useHike((s) => s.waypoints);
  const route = useHike((s) => s.route);
  const select = useHike((s) => s.select);
  const active = useActiveWaypoint();
  const heading = useEffectiveHeading(active);

  return (
    <div className="grid overflow-hidden rounded-[10px] border border-line-strong bg-card shadow-[6px_6px_0_rgb(0_0_0/0.14)] md:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2.5 border-b border-line p-4 md:border-r md:border-b-0">
        <div className="font-display text-xl font-bold">{title}</div>
        <div className="flex items-center gap-2.5 text-sm text-bark">{stats}</div>
        <ol className="flex flex-col gap-2.5" aria-label="First steps of the guide">
          {steps.map((wp) => {
            const on = wp.id === active?.id;
            return (
              <li key={wp.id}>
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  onClick={() => select(wp.id)}
                  className={cn("flex w-full cursor-pointer gap-2.5 rounded-[10px] border-[1.5px] p-2.5 text-left", on ? "border-forest bg-highlight" : "border-line bg-card hover:border-line-strong")}
                >
                  <Pin type={wp.type} size={26} className="flex-none" />
                  <span>
                    <span className="block font-display leading-tight font-bold">{wp.label}</span>
                    <span className="block text-sm text-bark">
                      {formatMiles(wp.mile)} · {wp.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <TrailMap route={route} waypoints={waypoints} activeId={active?.id} heading={heading} labels onSelect={(id) => select(id)} className="h-[320px] md:h-auto md:min-h-[440px]" />
    </div>
  );
}
