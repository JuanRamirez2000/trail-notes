"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { elevationAt, profileExtent, type ProfilePoint } from "@/lib/elevation";
import { formatFeet, formatMiles } from "@/lib/format";
import { useHike } from "@/lib/hike-store";
import type { ManifestProps } from "@/lib/mdx/manifest";
import { componentIcons } from "./icons";

/** Props are defined in lib/mdx/manifest.ts. */
export type ElevationProfileProps = ManifestProps<"ElevationProfile">;

/** The line is drawn in a 1000 × 100 box stretched to the plot; everything else is placed in percent. */
const W = 1000;
const H = 100;
/** Room above the highest point for its pin, and below the lowest so the line never sits on the axis. */
const PAD_TOP = 0.2;
const PAD_BOTTOM = 0.12;

/** Round gridline values: about three across the hike's range. */
function gridFeet(minFt: number, maxFt: number): number[] {
  const step = [100, 200, 250, 500, 1000, 2000, 5000].find((s) => (maxFt - minFt) / s <= 3.5) ?? 10000;
  const lines = [];
  for (let ft = Math.ceil(minFt / step) * step; ft <= maxFt; ft += step) lines.push(ft);
  return lines;
}

/**
 * `<ElevationProfile />`: the climb along the recorded track, with the hike's pins on the line.
 * It shares the page's selection with the maps and step lists: the active pin is marked here, and
 * clicking the plot selects the pin nearest along the trail, which moves the maps and scrolls the
 * guide to its section. The pins are marks, not buttons: on a phone they sit a few pixels apart,
 * too close to be separate touch targets. The step list and the minimap's Prev/Next do the same
 * job from the keyboard.
 */
export function ElevationProfile({ height = 180 }: ElevationProfileProps) {
  const profile = useHike((s) => s.profile);
  const waypoints = useHike((s) => s.waypoints);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const [hoverMi, setHoverMi] = useState<number | null>(null);

  const chart = useMemo(() => (profile ? layout(profile) : null), [profile]);

  if (!profile || !chart) {
    return (
      <Frame icon={componentIcons.ElevationProfile} title="Elevation" expandable={false}>
        <p className="px-3 py-4 text-[15px] text-bark">This hike has no recorded track yet, so there&rsquo;s no elevation profile to show.</p>
      </Frame>
    );
  }

  const { extent, x, y, line, area, grid, miles } = chart;
  const pins = waypoints.filter((w) => w.mile >= 0 && w.mile <= extent.totalMi).map((w) => ({ wp: w, ft: elevationAt(profile, w.mile) }));
  const active = pins.find((p) => p.wp.id === activeId);
  const hover = hoverMi === null ? null : { mile: hoverMi, ft: elevationAt(profile, hoverMi) };

  const mileAt = (e: { clientX: number; currentTarget: HTMLDivElement }) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.min(extent.totalMi, Math.max(0, ((e.clientX - box.left) / box.width) * extent.totalMi));
  };
  const nearestPin = (mile: number) => pins.reduce<(typeof pins)[number] | null>((best, p) => (!best || Math.abs(p.wp.mile - mile) < Math.abs(best.wp.mile - mile) ? p : best), null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => setHoverMi(mileAt(e));
  // The pin a click would select, named in the readout once the pointer is within a twentieth of the plot of it.
  const near = hover && nearestPin(hover.mile);
  const nearName = near && Math.abs(near.wp.mile - hover.mile) <= extent.totalMi / 20 ? near.wp.label : null;

  return (
    <Frame icon={componentIcons.ElevationProfile} title="Elevation" meta={`${formatFeet(extent.minFt)} to ${formatFeet(extent.maxFt)}`} expandable={false}>
      <div className="px-3 pt-3 pb-2">
        <div
          className={cn("relative", pins.length > 0 && "cursor-pointer")}
          style={{ height }}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverMi(null)}
          onClick={(e) => {
            const pin = nearestPin(mileAt(e));
            if (pin) select(pin.wp.id, { reveal: true });
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            role="img"
            aria-label={`Elevation along the route: ${formatFeet(profile[0][1])} at the start, highest point ${formatFeet(extent.maxFt)} at mile ${extent.maxAtMi.toFixed(1)}, ${formatFeet(profile.at(-1)![1])} at the end of ${formatMiles(extent.totalMi)}.`}
          >
            {grid.map((ft) => (
              <line key={ft} x1={0} x2={W} y1={y(ft)} y2={y(ft)} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="var(--color-highlight)" />
            <path d={line} fill="none" stroke="var(--color-forest)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Gridline values sit on the right edge, above their line: the trailhead pin is at the left one. */}
          {grid.map((ft) => (
            <span key={ft} className="pointer-events-none absolute right-0 -translate-y-full font-mono text-[11px] leading-4 text-bark" style={{ top: `${y(ft)}%` }} aria-hidden>
              {formatFeet(ft)}
            </span>
          ))}

          {active && <span className="pointer-events-none absolute inset-y-0 border-l border-dashed border-graphite" style={{ left: `${(x(active.wp.mile) / W) * 100}%` }} aria-hidden />}

          {hover && (
            <>
              <span className="pointer-events-none absolute inset-y-0 border-l border-line-strong" style={{ left: `${(x(hover.mile) / W) * 100}%` }} aria-hidden />
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-forest"
                style={{ left: `${(x(hover.mile) / W) * 100}%`, top: `${y(hover.ft)}%` }}
                aria-hidden
              />
              <span
                className={cn(
                  "pointer-events-none absolute top-0 z-10 rounded border border-line bg-card px-1.5 font-mono text-[11px] leading-5 whitespace-nowrap text-graphite shadow-sketch",
                  hover.mile > extent.totalMi / 2 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2",
                )}
                style={{ left: `${(x(hover.mile) / W) * 100}%` }}
                aria-hidden
              >
                {formatMiles(hover.mile)} · {formatFeet(Math.round(hover.ft))}
                {nearName && ` · ${nearName}`}
              </span>
            </>
          )}

          {pins.map(({ wp, ft }) => (
            <span
              key={wp.id}
              className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2", wp.id === activeId && "z-[5]")}
              style={{ left: `${(x(wp.mile) / W) * 100}%`, top: `${y(ft)}%` }}
              aria-hidden
            >
              <Pin type={wp.type} size={wp.id === activeId ? 18 : 14} active={wp.id === activeId} />
            </span>
          ))}
        </div>

        {/* Mile axis */}
        <div className="relative mt-1 h-4 border-t border-line-strong font-mono text-[11px] leading-4 text-bark" aria-hidden>
          {miles.map((m, i) => (
            <span
              key={m}
              className={cn("absolute top-0 whitespace-nowrap", i === 0 ? "" : i === miles.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
              style={{ left: `${(x(m) / W) * 100}%` }}
            >
              {i === miles.length - 1 ? formatMiles(m) : m}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function layout(profile: ProfilePoint[]) {
  const extent = profileExtent(profile);
  const span = Math.max(1, extent.maxFt - extent.minFt);
  const top = extent.maxFt + span * PAD_TOP;
  const bottom = extent.minFt - span * PAD_BOTTOM;
  const x = (mile: number) => (mile / (extent.totalMi || 1)) * W;
  const y = (ft: number) => ((top - ft) / (top - bottom)) * H;
  const line = profile.map(([m, ft], i) => `${i ? "L" : "M"}${x(m).toFixed(1)} ${y(ft).toFixed(2)}`).join("");
  const area = `${line}L${W} ${H}L0 ${H}Z`;
  // Whole miles, dropping the last one if it would run into the total at the right edge.
  const whole = Array.from({ length: Math.floor(extent.totalMi) + 1 }, (_, i) => i).filter((m) => extent.totalMi - m > extent.totalMi * 0.08);
  return { extent, x, y, line, area, grid: gridFeet(extent.minFt, extent.maxFt), miles: [...whole, extent.totalMi] };
}
