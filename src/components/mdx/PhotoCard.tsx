"use client";

import { Frame } from "@/components/ui/Frame";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { waypointHeading } from "./labels";
import { MissingWaypoint } from "./MissingWaypoint";
import { PanoViewer } from "./PanoViewer";
import type { ManifestProps } from "@/lib/mdx/manifest";
import { componentIcons } from "./icons";

/** Props are defined in lib/mdx/manifest.ts. */
export type PhotoCardProps = ManifestProps<"PhotoCard">;

/** Photo linked to its map pin. 360° photos hand off to <PanoViewer />. */
export function PhotoCard({ waypoint, caption }: PhotoCardProps) {
  const wp = useWaypoint(waypoint);
  const select = useHike((s) => s.select);
  const openPhoto = useHike((s) => s.openPhoto);
  const isActive = useHike((s) => s.activeId === waypoint);

  if (!wp) return <MissingWaypoint component="PhotoCard" id={waypoint} />;
  if (wp.photo?.kind === "pano") return <PanoViewer waypoint={waypoint} />;

  const text = caption ?? wp.caption ?? wp.title;
  return (
    <div data-waypoint-card={wp.id}>
      <Frame icon={componentIcons.PhotoCard}
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
            <>
              <Photo photoKey={wp.photo.key} alt={wp.photo.alt ?? text} className="absolute inset-0" />
              <button type="button" onClick={() => openPhoto(wp.id)} aria-label={`View the photo full size: ${text}`} className="absolute inset-0 cursor-zoom-in" />
            </>
          ) : (
            <div className="bg-stripes absolute inset-0 flex items-center justify-center font-mono text-xs text-bark">no photo</div>
          )}
          <Pin type={wp.type} size={26} className="pointer-events-none absolute left-2.5 top-2.5" />
        </div>
      </Frame>
    </div>
  );
}
