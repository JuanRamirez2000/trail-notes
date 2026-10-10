"use client";

import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { isSafety } from "@/lib/hike";
import { useHike } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { componentIcons } from "./icons";

/**
 * `<SafetyPoints />`: water, bail-outs and ranger stations against the route's distance (design:
 * Trailnotes Components, "Safety pins · strip"). A strip from the trailhead to the last pin with
 * each safety pin where it falls, then a row for each with its mileage and note.
 */
export function SafetyPoints() {
  const waypoints = useHike((s) => s.waypoints);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const safety = waypoints.filter(isSafety);
  const total = Math.max(...waypoints.map((w) => w.mile), 0);
  const at = (mile: number) => `${total > 0 ? Math.min(100, Math.max(0, (mile / total) * 100)) : 0}%`;
  // A whole-mile tick wherever there's room for its number before the total at the end.
  const ticks = Array.from({ length: Math.floor(total) + 1 }, (_, mi) => mi).filter((mi) => total - mi > total * 0.08);

  return (
    <Frame icon={componentIcons.SafetyPoints} title="Safety points" meta={safety.length ? String(safety.length) : undefined} expandable={false} footer="The same pins as on the map, shown against distance.">
      {safety.length === 0 ? (
        <p className="px-3.5 py-3 text-[15px] text-bark">No water, bail-outs or ranger stations recorded for this hike.</p>
      ) : (
        <>
          <div className="px-7 pt-7 pb-4" aria-hidden>
            <div className="relative h-8">
              <div className="absolute inset-x-0 top-3.5 border-t-[3px] border-dashed border-forest" />
              <span className="absolute top-[5px] left-0 box-border size-5 -translate-x-1/2 rounded-full border-2 border-white bg-forest shadow-[var(--shadow-pin)]" />
              {safety.map((w) => (
                <Pin key={w.id} type={w.type} size={25} active={w.id === activeId} className="absolute top-px -translate-x-1/2" style={{ left: at(w.mile) }} />
              ))}
            </div>
            <div className="relative mt-2.5 h-[18px] font-mono text-[11px] text-bark">
              {ticks.map((mi) => (
                <span key={mi} className="absolute -translate-x-1/2" style={{ left: at(mi) }}>
                  {mi}
                </span>
              ))}
              <span className="absolute right-0 translate-x-1/2 whitespace-nowrap">{total.toFixed(1)} mi</span>
            </div>
          </div>
          <ul className="border-t border-line">
            {safety.map((w) => (
              <li key={w.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => select(w.id, { reveal: true })} className={cn("flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left", w.id === activeId && "bg-highlight")}>
                  <b className="w-14 flex-none font-mono text-[13px] font-semibold" style={{ color: PIN_STYLES[w.type].color }}>
                    {w.mile.toFixed(1)} mi
                  </b>
                  <span className="flex-1">
                    <b>{w.label}.</b> {w.note ?? PIN_STYLES[w.type].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Frame>
  );
}
