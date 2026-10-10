"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { MarkerConfig, MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { SketchMap } from "@/components/map/SketchMap";
import { useNearViewport } from "@/components/map/useInView";
import { canCreateWebGL2 } from "@/components/map/webgl";
import { Photo } from "@/components/ui/Photo";
import { cn } from "@/lib/cn";
import { bearing, compassLabel, distanceMi, normalizeHeading } from "@/lib/geo";
import type { HikeWaypoint, RouteCoords } from "@/lib/hike";
import { useHike, useWaypoint } from "@/lib/hike-store";
import { PIN_STYLES } from "@/lib/pins";
import { photoUrl } from "@/lib/storage";
import { MissingWaypoint } from "./MissingWaypoint";
import type { ManifestProps } from "@/lib/mdx/manifest";

/** Props are defined in lib/mdx/manifest.ts. */
export type PanoViewerProps = ManifestProps<"PanoViewer">;

const DEG = Math.PI / 180;

/**
 * Photo Sphere Viewer yaw 0 is the centre of the equirectangular image and grows clockwise,
 * so world heading = image-centre heading (waypoint.heading) + yaw.
 */
const yawToHeading = (wp: HikeWaypoint, yawRad: number) => normalizeHeading((wp.heading ?? 0) + yawRad / DEG);
const headingToYaw = (wp: HikeWaypoint, heading: number) => (heading - (wp.heading ?? 0)) * DEG;

/** Pin labels are the author's text. Photo Sphere Viewer inserts marker content as HTML, so they're escaped. */
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function markersFor(wp: HikeWaypoint, all: HikeWaypoint[], radiusMi: number): MarkerConfig[] {
  return all
    .filter((o) => o.id !== wp.id && distanceMi(wp, o) <= radiusMi)
    .map((o) => {
      const s = PIN_STYLES[o.type];
      return {
        id: o.id,
        position: { yaw: headingToYaw(wp, bearing(wp, o)), pitch: -0.12 },
        html: `<span class="pano-marker"><span class="pano-marker-pin" style="background:${s.color};color:${s.ink};border-radius:${s.radius}">${s.glyph}</span>${escapeHtml(o.label)}</span>`,
        anchor: "center center",
        tooltip: `${escapeHtml(o.label)} · ${distanceMi(wp, o).toFixed(1)} mi`,
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
    <PanoShell wp={current} waypoints={waypoints} route={route} heading={heading} active={isActive} onPointerDown={() => select(current.id)} bodyRef={nearRef}>
      {failed ? (
        <>
          {/* No WebGL: show the panorama flat, centred on its heading, instead of PSV's error overlay. */}
          <Photo photoKey={current.photo.key} alt={current.photo.alt ?? current.title} className="absolute inset-0" />
          <div className="absolute inset-x-2 top-14 z-10 mx-auto max-w-sm rounded-lg border border-line bg-card px-3 py-2 text-center text-sm">
            The interactive 360° view needs WebGL, which this browser isn&apos;t providing right now. Showing the flat panorama instead.
          </div>
        </>
      ) : (
        <div ref={containerRef} className="absolute inset-0" />
      )}
      {panos.length > 1 && (
        <>
          <button type="button" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous 360° spot" className={cn(spotButton, "left-2.5")}>
            ◀
          </button>
          <button type="button" disabled={idx >= panos.length - 1} onClick={() => go(1)} aria-label="Next 360° spot" className={cn(spotButton, "right-2.5")}>
            ▶
          </button>
        </>
      )}
    </PanoShell>
  );
}

const spotButton = "absolute top-1/2 z-10 flex size-[38px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card disabled:cursor-default disabled:opacity-40";

type ShellProps = {
  wp: HikeWaypoint;
  waypoints: HikeWaypoint[];
  route: RouteCoords;
  /** Where the viewer is looking, or the photo's own direction when there's nothing to look around in. */
  heading: number | null;
  active?: boolean;
  onPointerDown?: () => void;
  bodyRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/**
 * What surrounds a 360° photo (design: Trailnotes Components, "360° viewer"): the photo to the
 * block's edges, a label top left, a round map top right whose cone follows where you look, and
 * a compass tape along the bottom.
 */
function PanoShell({ wp, waypoints, route, heading, active, onPointerDown, bodyRef, children }: ShellProps) {
  return (
    <div data-waypoint-card={wp.id} className="not-prose my-[22px]">
      <div
        ref={bodyRef}
        role="group"
        aria-label={`360° view: ${wp.label}`}
        onPointerDown={onPointerDown}
        className={cn("bg-stripes relative h-[240px] overflow-hidden rounded-[10px] border sm:h-[340px]", active ? "border-forest shadow-[0_0_0_1px_var(--color-forest)]" : "border-line")}
      >
        {children}
        <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-full border border-line-strong bg-card px-3 py-[3px] font-mono text-xs font-semibold">360° · {wp.label}</div>
        <div className="absolute top-3 right-3 z-10 size-[72px] overflow-hidden rounded-full border-[3px] border-white shadow-[0_0_0_1.5px_var(--color-graphite)] sm:size-[92px]">
          {/* Sketch rather than Mapbox: a live map here would cost another WebGL context. */}
          <SketchMap waypoints={waypoints} route={route} activeId={wp.id} heading={heading} fit="active" pinSize={14} className="size-full" />
        </div>
        {heading != null && <CompassTape heading={heading} />}
      </div>
    </div>
  );
}

/** The compass around the current direction: two points either side, and the heading itself in the middle. */
function CompassTape({ heading }: { heading: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex h-11 items-center justify-between rounded-lg border border-line-strong bg-card px-[18px] font-mono text-xs font-semibold text-bark" aria-label={`Facing ${compassLabel(heading)}, ${Math.round(heading)}°`} role="img">
      {[-90, -45, 0, 45, 90].map((off, i) => (
        <Fragment key={off}>
          {i > 0 && <span aria-hidden>·</span>}
          {off === 0 ? (
            <span className="border-b-[3px] border-ochre px-1.5 pb-0.5 text-graphite">
              {compassLabel(heading)} {Math.round(heading)}°
            </span>
          ) : (
            <span className={cn(Math.abs(off) === 90 && "max-sm:hidden")}>{compassLabel(heading + off)}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** Stand-in until the waypoint has a 360° photo: the same surroundings, no viewer. */
function PanoPlaceholder({ wp, waypoints, route }: { wp: HikeWaypoint; waypoints: HikeWaypoint[]; route: RouteCoords }) {
  return (
    <PanoShell wp={wp} waypoints={waypoints} route={route} heading={wp.heading}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-lg border border-dashed border-line-strong bg-card px-4 py-2 text-center">
          <div className="font-mono text-xs tracking-[.06em] text-bark uppercase">360° photo</div>
          <div className="text-[15px]">Coming soon</div>
        </div>
      </div>
    </PanoShell>
  );
}
