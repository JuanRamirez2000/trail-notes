"use client";

import type { ReactNode } from "react";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { formatMiles } from "@/lib/format";
import { sectionId } from "@/lib/hike";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { MissingWaypoint } from "./MissingWaypoint";
import { PanoViewer } from "./PanoViewer";
import type { ManifestProps } from "@/lib/mdx/manifest";

/** Props are defined in lib/mdx/manifest.ts (`auto` is set on generated stub sections). */
export type StepProps = ManifestProps<"Step"> & { children?: ReactNode };

/**
 * One section of the guide, tied to a map pin. Required pin types (trailhead, turn, note,
 * bail-out) always get one, generated if missing; optional types (viewpoint, water) only when written.
 * The dotted rail on the left is the "pencil trail" motif linking sections down the page.
 */
export function Step({ waypoint, hidePhoto, auto, children }: StepProps) {
  const wp = useWaypoint(waypoint);
  const active = useHike((s) => s.activeId === waypoint);
  const select = useHike((s) => s.select);
  const openPhoto = useHike((s) => s.openPhoto);
  if (!wp) return <MissingWaypoint component="Step" id={waypoint} />;

  const style = PIN_STYLES[wp.type];
  const eyebrow = [wp.stepIndex !== null ? `Step ${wp.stepIndex + 1}` : null, style.label, formatMiles(wp.mile)].filter(Boolean).join(" · ");

  return (
    <section
      id={sectionId(wp.id)}
      data-step-section={wp.id}
      className="relative mt-8 grid scroll-mt-24 grid-cols-[36px_minmax(0,1fr)] gap-x-3 sm:gap-x-4"
    >
      <div className="relative flex items-start justify-center" aria-hidden>
        <span className="absolute top-9 bottom-[-2rem] border-l-2 border-dotted border-line-strong" />
        <button type="button" onClick={() => select(wp.id)} className="relative mt-1 cursor-pointer" tabIndex={-1}>
          <Pin type={wp.type} size={28} active={active} />
        </button>
      </div>
      <div className="min-w-0">
        <div className={cn("text-caption font-semibold tracking-[.06em] uppercase", active ? "text-forest" : "text-bark")}>{eyebrow}</div>
        <h2 className="mt-0.5 font-display text-[24px] leading-[30px] font-bold text-forest">{wp.title}</h2>

        {!hidePhoto && wp.photo?.kind === "pano" && <PanoViewer waypoint={wp.id} />}
        {!hidePhoto && wp.photo?.kind === "flat" && (
          <figure data-waypoint-card={wp.id} className="mt-3.5 overflow-hidden rounded-[10px] border border-line bg-card">
            <div className="relative aspect-video">
              <Photo photoKey={wp.photo.key} alt={wp.photo.alt ?? wp.title} className="absolute inset-0" />
              <button type="button" onClick={() => openPhoto(wp.id)} aria-label={`View the photo full size: ${wp.title}`} className="absolute inset-0 cursor-zoom-in" />
            </div>
            {(wp.caption || wp.note) && (
              <figcaption className="flex flex-col gap-2 border-t border-dashed border-line-strong px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex-1">
                  {wp.caption}
                  {wp.note && <span className="text-bark"> · {wp.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => select(wp.id)}
                  className="min-h-8 cursor-pointer self-start rounded-full border border-line px-3 text-[15px] whitespace-nowrap hover:border-forest sm:self-auto"
                >
                  ◉ Show on map
                </button>
              </figcaption>
            )}
          </figure>
        )}
        {(hidePhoto || !wp.photo) && (wp.caption || wp.note) && (
          <p className="mt-3 text-body">
            {wp.caption}
            {wp.note && <span className="text-bark"> · {wp.note}</span>}
          </p>
        )}

        {children}
        {auto && process.env.NODE_ENV === "development" && (
          <p className="mt-2 font-mono text-xs text-bark">Auto-generated section: add a &lt;Step waypoint=&quot;{wp.id}&quot;&gt; block to write this part of the guide.</p>
        )}
      </div>
    </section>
  );
}
