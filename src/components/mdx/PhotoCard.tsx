"use client";

import { Frame } from "@/components/ui/Frame";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { waypointHeading } from "./labels";
import { MissingWaypoint } from "./MissingWaypoint";
import { PanoViewer } from "./PanoViewer";
import { useReveal } from "./useReveal";

export type PhotoCardProps = {
  /** Waypoint id from waypoints.json. */
  waypoint: string;
  /** Overrides the waypoint caption. */
  caption?: string;
};

/** Photo linked to its map pin. 360° photos hand off to <PanoViewer />. */
export function PhotoCard({ waypoint, caption }: PhotoCardProps) {
  const wp = useWaypoint(waypoint);
  const select = useHike((s) => s.select);
  const isActive = useHike((s) => s.activeId === waypoint);
  const ref = useReveal<HTMLDivElement>(waypoint);

  if (!wp) return <MissingWaypoint component="PhotoCard" id={waypoint} />;
  if (wp.photo?.kind === "pano") return <PanoViewer waypoint={waypoint} />;

  const text = caption ?? wp.caption ?? wp.title;
  return (
    <div ref={ref}>
      <Frame
        title={waypointHeading(wp)}
        active={isActive}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex-1 text-lg leading-snug">{text}</span>
            <button
              type="button"
              onClick={() => select(wp.id)}
              className="min-h-8 cursor-pointer self-start whitespace-nowrap rounded-full border border-line px-3 text-[15px] hover:border-forest sm:self-auto"
            >
              ◉ View on map →
            </button>
          </div>
        }
      >
        <div className="relative aspect-video">
          {wp.photo ? (
            <Photo photoKey={wp.photo.key} alt={wp.photo.alt ?? text} className="absolute inset-0" />
          ) : (
            <div className="bg-stripes absolute inset-0 flex items-center justify-center font-mono text-xs text-bark">no photo</div>
          )}
          <Pin type={wp.type} size={26} className="absolute left-2.5 top-2.5" />
        </div>
      </Frame>
    </div>
  );
}
