"use client";

import { cn } from "@/lib/cn";
import { Frame } from "@/components/ui/Frame";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { formatMiles } from "@/lib/format";
import { sectionId } from "@/lib/hike";
import { useHike } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import type { ManifestProps } from "@/lib/mdx/manifest";
import { componentIcons } from "./icons";

/** Props are defined in lib/mdx/manifest.ts. */
export type StepByStepProps = ManifestProps<"StepByStep">;

/** Clickable step list. Selecting a step highlights it on every map and opens its photo. */
export function StepByStep({ showMeta = true }: StepByStepProps) {
  const steps = useHike((s) => s.steps);
  const activeId = useHike((s) => s.activeId);
  const select = useHike((s) => s.select);
  const total = steps.at(-1)?.mile ?? 0;

  return (
    <Frame icon={componentIcons.StepByStep}
      title="Step-by-step"
      meta={`${steps.length} steps · ${formatMiles(total)}`}
      footer="Tap a step: the minimap highlights it and its photo opens."
    >
      <ol>
        {steps.map((s) => {
          const open = s.id === activeId;
          return (
            <li key={s.id} className={cn("border-b border-line last:border-b-0", open ? "bg-highlight" : "bg-card")}>
              <button
                type="button"
                onClick={() => select(open ? null : s.id)}
                aria-expanded={open}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <Pin type={s.type} size={26} />
                <span className="flex-1 text-base sm:text-lg">{s.title}</span>
                <span className="text-sm whitespace-nowrap text-bark">
                  {showMeta && <span className="hidden sm:inline">{PIN_STYLES[s.type].label} · </span>}
                  {formatMiles(s.mile)}
                </span>
              </button>
              {open && (
                <div className="flex flex-col gap-3.5 px-3.5 pb-3.5 sm:flex-row sm:items-start sm:pl-[52px]">
                  {s.photo && (
                    <Photo
                      photoKey={s.photo.key}
                      variant="thumb"
                      alt={s.photo.alt ?? s.title}
                      sizes="260px"
                      className="aspect-video w-full flex-none border-[1.5px] border-line-strong sm:h-[150px] sm:w-[260px]"
                    />
                  )}
                  <p className="text-base">
                    {s.caption ?? s.title}
                    <br />
                    <a
                      href={`#${sectionId(s.id)}`}
                      className="underline"
                      onClick={(e) => {
                        e.preventDefault();
                        select(s.id, { reveal: true });
                      }}
                    >
                      Show photo ◉
                    </a>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}
