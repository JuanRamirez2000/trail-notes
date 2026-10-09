"use client";

import { gpxPath } from "@/lib/gpx-export";
import { useHike } from "@/lib/hike-store";
import type { ManifestProps } from "@/lib/mdx/manifest";

/** Props are defined in lib/mdx/manifest.ts. */
export type GpxDownloadProps = ManifestProps<"GpxDownload">;

/**
 * `<GpxDownload />`: the guide's route and pins as a file for a map app or a GPS watch. The file
 * is made from the published guide, so in the editor the button leads nowhere until then.
 */
export function GpxDownload(_props: GpxDownloadProps) {
  const slug = useHike((s) => s.slug);
  const pins = useHike((s) => s.waypoints.length);
  const recorded = useHike((s) => s.profile !== null);
  return (
    <div className="not-prose my-[22px] flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-line bg-card px-4 py-3">
      <p className="min-w-0 flex-1 basis-56 leading-snug">
        <span className="font-display text-lg font-bold">Take the route with you</span>
        <span className="block text-[15px] text-bark">
          {recorded ? "The recorded track" : "The route's pins, without a recorded track"}
          {recorded && pins > 0 && ` and ${pins} pin${pins === 1 ? "" : "s"}`}, as a GPX file for your map app or watch.
        </span>
      </p>
      <a href={gpxPath(slug)} download className="rounded-lg bg-forest px-4 py-2 text-paper no-underline hover:text-paper">
        ↓ Download GPX
      </a>
    </div>
  );
}
