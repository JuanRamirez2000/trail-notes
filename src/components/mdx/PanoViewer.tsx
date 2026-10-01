"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { MarkerConfig, MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { useEffect, useMemo, useRef, useState } from "react";
import { SketchMap } from "@/components/map/SketchMap";
import { useNearViewport } from "@/components/map/useInView";
import { canCreateWebGL2 } from "@/components/map/webgl";
import { Frame } from "@/components/ui/Frame";
import { Photo } from "@/components/ui/Photo";
import { bearing, compassLabel, distanceMi, normalizeHeading } from "@/lib/geo";
import type { HikeWaypoint, RouteCoords } from "@/lib/hike";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { photoUrl } from "@/lib/storage";
import { MissingWaypoint } from "./MissingWaypoint";

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
  const route = useHike((s) => s.route);
  const select = useHike((s) => s.select);
  const setView = useHike((s) => s.setView);
  const isActive = useHike((s) => s.activeId === waypoint);
  const initial = useWaypoint(waypoint);

  const panos = useMemo(() => waypoints.filter((w) => w.photo?.kind === "pano"), [waypoints]);
  const [currentId, setCurrentId] = useState(waypoint);
  const current = panos.find((w) => w.id === currentId) ?? initial;
  const [heading, setHeading] = useState(current?.heading ?? 0);

  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  // Viewer event handlers are bound once, so they read the current waypoint through a ref.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // The viewer (and its WebGL context) only lives while the card is near the viewport;
  // three.js is fetched the first time it's needed.
  useEffect(() => {
    const wp = currentRef.current;
    if (!near || failed || !containerRef.current || !wp?.photo) return;
    let disposed = false;
    let frame = 0;

    (async () => {
      const [{ Viewer }, { MarkersPlugin }] = await Promise.all([
        import("@photo-sphere-viewer/core"),
        import("@photo-sphere-viewer/markers-plugin"),
      ]);
      if (disposed || !containerRef.current) return;
      // PSV caches a failed WebGL check for the whole page, so probe first and fall back ourselves.
      if (!canCreateWebGL2()) return setFailed(true);

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
      // three's WebGLRenderer.dispose() frees GPU resources but keeps the context alive;
      // force it lost so scrolling past the viewer gives the context back to the browser.
      const viewer = viewerRef.current as unknown as { renderer?: { renderer?: { forceContextLoss?: () => void } } } | null;
      viewer?.renderer?.renderer?.forceContextLoss?.();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      markersRef.current = null;
      setView(null);
    };
    // Viewer is created once; waypoint switches go through setPanorama below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, failed]);

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
  if (current.photo?.kind !== "pano") return <PanoPlaceholder wp={current} waypoints={waypoints} route={route} />;

  const idx = panos.findIndex((p) => p.id === current.id);
  const go = (d: number) => panos[idx + d] && setCurrentId(panos[idx + d].id);

  return (
    <div data-waypoint-card={current.id}>
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
        <div ref={nearRef} className="bg-stripes relative h-[220px] sm:h-[360px]" onPointerDown={() => select(current.id)}>
          {failed ? (
            <>
              {/* No WebGL: show the panorama flat, centred on its heading, instead of PSV's error overlay. */}
              <Photo photoKey={current.photo.key} alt={current.photo.alt ?? current.title} className="absolute inset-0" />
              <div className="absolute inset-x-2 top-12 z-10 mx-auto max-w-sm rounded-lg border border-line bg-card px-3 py-2 text-center text-sm sm:top-14">
                The interactive 360° view needs WebGL, which this browser isn&apos;t providing right now. Showing the flat panorama instead.
              </div>
            </>
          ) : (
            <div ref={containerRef} className="absolute inset-0" />
          )}
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-line bg-card px-2.5 py-0.5 font-mono text-xs font-semibold sm:left-3.5 sm:top-3.5">
            <span className="hidden sm:inline">Facing </span>
            {compassLabel(heading)} · {Math.round(heading)}°
          </div>
          <div data-hidden={failed} className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full data-[hidden=true]:hidden border border-line bg-card px-3 text-sm sm:bottom-3.5 sm:left-1/2 sm:-translate-x-1/2 sm:text-[15px]">
            ◀ drag to look around ▶
          </div>
          <div className="absolute bottom-2 right-2 z-10 size-[84px] overflow-hidden rounded-lg border-2 border-forest sm:bottom-3.5 sm:right-3.5 sm:size-[130px]">
            {/* Sketch rather than Mapbox: a live map here would cost another WebGL context. */}
            <SketchMap waypoints={waypoints} route={route} activeId={current.id} heading={heading} fit="active" pinSize={16} className="size-full" />
          </div>
        </div>
      </Frame>
    </div>
  );
}

/** Stand-in until the waypoint has a 360° photo: same frame and inset map, no viewer. */
function PanoPlaceholder({ wp, waypoints, route }: { wp: HikeWaypoint; waypoints: HikeWaypoint[]; route: RouteCoords }) {
  return (
    <div data-waypoint-card={wp.id}>
      <Frame title={`360° view · ${wp.label}`} footer={<span className="text-bark">No 360° photo for this spot yet.</span>}>
        <div className="bg-stripes relative flex h-[220px] items-center justify-center sm:h-[360px]">
          <div className="rounded-lg border border-dashed border-line-strong bg-card px-4 py-2 text-center">
            <div className="font-mono text-xs tracking-[.06em] text-bark uppercase">360° photo</div>
            <div className="text-[15px]">Coming soon</div>
          </div>
          <div className="absolute right-2 bottom-2 size-[84px] overflow-hidden rounded-lg border-2 border-forest sm:right-3.5 sm:bottom-3.5 sm:size-[130px]">
            <SketchMap waypoints={waypoints} route={route} activeId={wp.id} heading={wp.heading} fit="active" pinSize={16} className="size-full" />
          </div>
        </div>
      </Frame>
    </div>
  );
}
