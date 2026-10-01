"use client";

import { useEffect, useRef } from "react";
import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { formatMiles } from "@/lib/format";
import type { HikeWaypoint } from "@/lib/hike";
import { useHike } from "@/lib/hike-store";

export type WaypointLinksProps = {
  title: string;
  waypoints: HikeWaypoint[];
  /** Main text of each row (defaults to the step instruction). */
  primary?: (wp: HikeWaypoint) => string;
  /** Second line under each row (e.g. a safety note). */
  detail?: (wp: HikeWaypoint) => string | undefined;
  empty?: string;
  /** Called after a row is picked (the mobile bar uses it to collapse). */
  onPick?: () => void;
  /** Render without the card frame (inside the mobile minimap bar). */
  bare?: boolean;
  className?: string;
};

/** Clickable list of waypoints: jumps the guide to each one and highlights the active row. */
export function WaypointLinks({ title, waypoints, primary = (wp) => wp.title, detail, empty, onPick, bare, className }: WaypointLinksProps) {
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the active row visible inside the list without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-step="${activeId}"]`);
    if (!list || !row) return;
    const top = row.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 3, behavior: "smooth" });
    }
  }, [activeId]);

  const list = (
    <ol ref={listRef} className={cn("min-h-0 overflow-y-auto", className)} aria-label={title}>
      {waypoints.length === 0 && empty && <li className="px-3 py-2 text-sm text-bark">{empty}</li>}
      {waypoints.map((wp) => {
        const on = wp.id === activeId;
        const sub = detail?.(wp);
        return (
          <li key={wp.id} data-step={wp.id} className={cn("border-b border-line last:border-b-0", on ? "bg-highlight" : "bg-card")}>
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              onClick={() => {
                // Let the mobile bar collapse first so the scroll target doesn't move mid-scroll.
                onPick?.();
                requestAnimationFrame(() => select(wp.id, { reveal: true }));
              }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
            >
              <Pin type={wp.type} size={22} className="m-0.5" />
              <span className="min-w-0 flex-1 leading-snug">
                {primary(wp)}
                {sub && <span className="block truncate text-caption text-bark">{sub}</span>}
              </span>
              <span className="text-sm whitespace-nowrap text-bark">{formatMiles(wp.mile)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  if (bare) return list;
  return (
    <Frame title={title} meta={String(waypoints.length)} expandable={false} className="my-0 max-h-full min-h-0" bodyClassName="flex min-h-0 flex-col">
      {list}
    </Frame>
  );
}
