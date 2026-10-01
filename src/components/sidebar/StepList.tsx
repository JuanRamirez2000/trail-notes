"use client";

import { useEffect, useRef } from "react";
import { Frame } from "@/components/ui/Frame";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { formatMiles } from "@/lib/format";
import { useHike } from "@/lib/hike-store";

type Props = {
  /** Called after a step is picked (the mobile bar uses it to collapse). */
  onPick?: () => void;
  /** Render without the card frame (inside the mobile minimap bar). */
  bare?: boolean;
  className?: string;
};

/** Quick links to every required section. Click to jump; highlights follow the scrollspy. */
export function StepList({ onPick, bare, className }: Props) {
  const steps = useHike((s) => s.steps);
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
    <ol ref={listRef} className={cn("min-h-0 overflow-y-auto", className)}>
      {steps.map((s) => {
        const on = s.id === activeId;
        return (
          <li key={s.id} data-step={s.id} className={cn("border-b border-line last:border-b-0", on ? "bg-highlight" : "bg-card")}>
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              onClick={() => {
                // Let the mobile bar collapse first so the scroll target doesn't move mid-scroll.
                onPick?.();
                requestAnimationFrame(() => select(s.id, { reveal: true }));
              }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
            >
              <Pin type={s.type} size={22} />
              <span className="flex-1 leading-snug">{s.title}</span>
              <span className="text-sm whitespace-nowrap text-bark">{formatMiles(s.mile)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  if (bare) return list;
  const total = steps.at(-1)?.mile ?? 0;
  return (
    <Frame title="Steps" meta={`${steps.length} · ${formatMiles(total)}`} expandable={false} className="my-0 max-h-full min-h-0" bodyClassName="flex min-h-0 flex-col">
      {list}
    </Frame>
  );
}
