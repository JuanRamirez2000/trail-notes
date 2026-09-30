"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { MarkerConfig, MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { useEffect, useMemo, useRef, useState } from "react";
import { TrailMap } from "@/components/map/TrailMap";
import { useInViewOnce } from "@/components/map/useInView";
import { Frame } from "@/components/ui/Frame";
import { bearing, compassLabel, distanceMi, normalizeHeading } from "@/lib/geo";
import type { HikeWaypoint } from "@/lib/hike";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { photoUrl } from "@/lib/storage";
import { MissingWaypoint } from "./MissingWaypoint";
import { useReveal } from "./useReveal";

export type PanoViewerProps = {
  /** Waypoint id whose photo is a 360° pano. */
  waypoint: string;
  /** Show direction markers for other waypoints within this many miles. */
  markerRadiusMi?: number;
};

const DEG = Math.PI / 180;

/**
 * Photo Sphere Viewer yaw 0 is the centre of the equirectangular image and grows clockwise,
 * so world heading = image-centre heading (waypoint.heading) + yaw.
 */
const yawToHeading = (wp: HikeWaypoint, yawRad: number) => normalizeHeading((wp.heading ?? 0) + yawRad / DEG);
const headingToYaw = (wp: HikeWaypoint, heading: number) => (heading - (wp.heading ?? 0)) * DEG;

function markersFor(wp: HikeWaypoint, all: HikeWaypoint[], radiusMi: number): MarkerConfig[] {
  return all
    .filter((o) => o.id !== wp.id && distanceMi(wp, o) <= radiusMi)
    .map((o) => {
      const s = PIN_STYLES[o.type];
      return {
        id: o.id,
        position: { yaw: headingToYaw(wp, bearing(wp, o)), pitch: -0.12 },
        html: `<span class="pano-marker"><span class="pano-marker-pin" style="background:${s.color};border-radius:${s.radius}">${s.glyph}</span>${o.label}</span>`,
        anchor: "center center",
        tooltip: `${o.label} · ${distanceMi(wp, o).toFixed(1)} mi`,
      };
    });
}

export function PanoViewer({ waypoint, markerRadiusMi = 1 }: PanoViewerProps) {
  const waypoints = useHike((s) => s.waypoints);
  const select = useHike((s) => s.select);
  const setView = useHike((s) => s.setView);
  const isActive = useHike((s) => s.activeId === waypoint);
  const initial = useWaypoint(waypoint);

  const panos = useMemo(() => waypoints.filter((w) => w.photo?.kind === "pano"), [waypoints]);
  const [currentId, setCurrentId] = useState(waypoint);
  const current = panos.find((w) => w.id === currentId) ?? initial;
  const [heading, setHeading] = useState(current?.heading ?? 0);

  const [inViewRef, inView] = useInViewOnce<HTMLDivElement>();
  const revealRef = useReveal<HTMLDivElement>(waypoint);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  // Viewer event handlers are bound once, so they read the current waypoint through a ref.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // Create the viewer once it scrolls near the viewport; three.js is only fetched then.
  useEffect(() => {
    const wp = currentRef.current;
    if (!inView || !containerRef.current || !wp?.photo) return;
    let disposed = false;
    let frame = 0;

    (async () => {
      const [{ Viewer }, { MarkersPlugin }] = await Promise.all([
        import("@photo-sphere-viewer/core"),
        import("@photo-sphere-viewer/markers-plugin"),
      ]);
      if (disposed || !containerRef.current) return;

      const viewer = new Viewer({
        container: containerRef.current,
        panorama: photoUrl(wp.photo!.key),
        defaultYaw: 0,
        defaultZoomLvl: 10,
        navbar: false,
        mousewheelCtrlKey: true,
        touchmoveTwoFingers: true,
        loadingTxt: "Loading 360° photo…",
        plugins: [MarkersPlugin.withConfig({ markers: markersFor(wp, waypoints, markerRadiusMi) })],
      });
      const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
      viewerRef.current = viewer;
      markersRef.current = markers;

      viewer.addEventListener("position-updated", ({ position }) => {
        // position-updated fires every frame while dragging; publish at most once per frame.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const wpNow = currentRef.current!;
          const h = yawToHeading(wpNow, position.yaw);
          setHeading(h);
          setView({ waypointId: wpNow.id, heading: h });
        });
      });

      markers.addEventListener("select-marker", ({ marker }) => {
        const target = waypoints.find((w) => w.id === marker.id);
        if (target?.photo?.kind === "pano") setCurrentId(target.id);
        else if (target) select(target.id, { reveal: true });
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      viewerRef.current?.destroy();
      viewerRef.current = null;
      markersRef.current = null;
      setView(null);
    };
    // Viewer is created once; waypoint switches go through setPanorama below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  // Prev/next spot: swap panorama in place instead of rebuilding the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !current?.photo) return;
    if (viewer.config.panorama === photoUrl(current.photo.key)) return;
    viewer.setPanorama(photoUrl(current.photo.key), { position: { yaw: 0, pitch: 0 }, transition: { speed: 800 } });
    markersRef.current?.setMarkers(markersFor(current, waypoints, markerRadiusMi));
    setHeading(current.heading ?? 0);
    select(current.id);
  }, [current, waypoints, markerRadiusMi, select]);

  if (!current) return <MissingWaypoint component="PanoViewer" id={waypoint} />;
  if (current.photo?.kind !== "pano") return <MissingWaypoint component="PanoViewer (photo is not a 360° pano)" id={waypoint} />;

  const idx = panos.findIndex((p) => p.id === current.id);
  const go = (d: number) => panos[idx + d] && setCurrentId(panos[idx + d].id);

  return (
    <div ref={revealRef}>
      <Frame
        title={`360° view · ${current.label}`}
        active={isActive}
        footer={
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={idx <= 0} onClick={() => go(-1)} className="cursor-pointer disabled:cursor-default disabled:opacity-40">
              ◀ Prev spot
            </button>
            <span className="hidden text-center sm:block">Cone on mini map follows where you look</span>
            <button type="button" disabled={idx >= panos.length - 1} onClick={() => go(1)} className="cursor-pointer disabled:cursor-default disabled:opacity-40">
              Next spot ▶
            </button>
          </div>
        }
      >
        <div ref={inViewRef} className="bg-stripes relative h-[220px] sm:h-[360px]" onPointerDown={() => select(current.id)}>
          <div ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-line bg-card px-2.5 py-0.5 font-mono text-xs font-semibold sm:left-3.5 sm:top-3.5">
            <span className="hidden sm:inline">Facing </span>
            {compassLabel(heading)} · {Math.round(heading)}°
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full border border-line bg-card px-3 text-sm sm:bottom-3.5 sm:left-1/2 sm:-translate-x-1/2 sm:text-[15px]">
            ◀ drag to look around ▶
          </div>
          <div className="absolute bottom-2 right-2 z-10 size-[84px] overflow-hidden rounded-lg border-2 border-forest sm:bottom-3.5 sm:right-3.5 sm:size-[130px]">
            <TrailMap waypoints={waypoints} activeId={current.id} heading={heading} fit="active" interactive={false} className="size-full" />
          </div>
        </div>
      </Frame>
    </div>
  );
}
