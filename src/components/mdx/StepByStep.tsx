"use client";

import { cn } from "@/lib/cn";
import { Frame } from "@/components/ui/Frame";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { formatMiles } from "@/lib/format";
import { useHike } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import type { ManifestProps } from "@/lib/mdx/manifest";
import { componentIcons } from "./icons";

/** Props are defined in lib/mdx/manifest.ts. */
export type StepByStepProps = ManifestProps<"StepByStep">;

/**
 * The hike as a timeline (design: Trailnotes Components, "Step-by-step"): mileage down the left,
 * the pins joined by the trail's dashed line, and the selected step's photo opened under it.
 * Selecting a step highlights it on every map.
 */
export function StepByStep({ showMeta = true }: StepByStepProps) {
  const steps = useHike((s) => s.steps);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const openPhoto = useHike((s) => s.openPhoto);
  const total = steps.at(-1)?.mile ?? 0;

  return (
    <Frame icon={componentIcons.StepByStep} title="Step-by-step" meta={`${steps.length} steps · ${formatMiles(total)}`} expandable={false} footer="Pick a step: the maps move to it and its photo opens.">
      <ol className="px-3 pt-2.5 pb-1 sm:px-4">
        {steps.map((s, i) => {
          const open = s.id === activeId;
          return (
            <li key={s.id} className="grid grid-cols-[52px_30px_minmax(0,1fr)] gap-x-2.5">
              <div className="text-right font-mono text-xs leading-[26px] font-semibold whitespace-nowrap text-bark">{s.mile.toFixed(1)} mi</div>
              <div className="flex flex-col items-center" aria-hidden>
                <Pin type={s.type} size={26} active={open} />
                {i < steps.length - 1 && <span className="min-h-3.5 flex-1 border-l-[3px] border-dashed border-forest" />}
              </div>
              <div className="pb-3.5">
                <button type="button" onClick={() => select(open ? null : s.id)} aria-expanded={open} className={cn("w-full cursor-pointer text-left text-[17px] leading-[26px]", open && "font-semibold")}>
                  {s.title}
                  {showMeta && <span className="ml-2 text-sm font-normal text-bark">{PIN_STYLES[s.type].label}</span>}
                </button>
                {open && s.photo?.kind === "flat" && (
                  <div className="relative mt-1.5 aspect-video max-w-[360px] overflow-hidden rounded-md border-[1.5px] border-line-strong">
                    <Photo photoKey={s.photo.key} variant="thumb" alt={s.photo.alt ?? s.title} sizes="360px" className="absolute inset-0" />
                    <button type="button" onClick={() => openPhoto(s.id)} aria-label={`View the photo full size: ${s.title}`} className="absolute inset-0 cursor-zoom-in" />
                  </div>
                )}
                {open && s.caption && <p className="mt-1.5 text-[15px] leading-snug text-bark">{s.caption}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}
