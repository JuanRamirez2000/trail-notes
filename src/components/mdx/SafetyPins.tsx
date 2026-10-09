"use client";

import { cn } from "@/lib/cn";
import { TrailMap } from "@/components/map/TrailMap";
import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { formatMiles } from "@/lib/format";
import { isSafety } from "@/lib/hike";
import { useHike } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import type { ManifestProps } from "@/lib/mdx/manifest";
import { componentIcons } from "./icons";

/** Props are defined in lib/mdx/manifest.ts. */
export type SafetyPinsProps = ManifestProps<"SafetyPins">;

/** Water and bail-out layer: safety pins emphasised, everything else faded back. */
export function SafetyPins({ height = 240 }: SafetyPinsProps) {
  const waypoints = useHike((s) => s.waypoints);
  const route = useHike((s) => s.route);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const safety = waypoints.filter(isSafety);

  return (
    <Frame icon={componentIcons.SafetyPins} title="Safety points" footer="Larger pins with a double halo mark water and bail-outs.">
      <div className="grid sm:grid-cols-[230px_minmax(0,1fr)]">
        <div className="border-b border-line sm:border-r sm:border-b-0" style={{ height }}>
          <TrailMap waypoints={waypoints} route={route} activeId={activeId} safety labels onSelect={(id) => select(id)} className="size-full" />
        </div>
        <ul className="flex flex-col gap-3 p-3.5">
          {safety.length === 0 && <li className="text-bark">No water or bail-out points recorded for this hike.</li>}
          {safety.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => select(w.id, { reveal: true })}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left",
                  w.id === activeId ? "border-forest bg-highlight" : "border-line",
                )}
              >
                <Pin type={w.type} size={24} className="m-1" />
                <span>
                  <b>{w.label}</b>
                  <br />
                  <span className="text-sm text-bark">
                    {formatMiles(w.mile)} · {w.note ?? PIN_STYLES[w.type].label.toLowerCase()}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
