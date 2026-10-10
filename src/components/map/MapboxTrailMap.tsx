"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/cn";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox";
import { Pin } from "@/components/ui/Pin";
import { bounds } from "@/lib/geo";
import { routeCoords } from "@/lib/hike";
import { isSafety } from "@/lib/hike";
import { MAPBOX_STYLE, MAPBOX_TOKEN, useCssColor } from "./config";
import { Cone } from "./Cone";
import { MapLabel } from "./SketchMap";
import type { TrailMapProps } from "./types";
import type { HikeWaypoint } from "@/lib/hike";

const ACTIVE_ZOOM = 15.5;

export default function MapboxTrailMap({
  waypoints,
  route,
  activeId,
  heading,
  labels,
  safety,
  onSelect,
  interactive = true,
  terrain,
  fit = "route",
  controls = "top-right",
  className,
  onLoad,
  onError,
}: TrailMapProps) {
  const mapRef = useRef<MapRef>(null);
  const forest = useCssColor("--color-forest");
  const active = waypoints.find((w) => w.id === activeId);
  const coords = useMemo(() => route ?? routeCoords(waypoints), [route, waypoints]);
  const line = useMemo(
    () => (coords.length >= 2 ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } } : null),
    [coords],
  );
  // Fit the whole route (track can extend beyond the pins), plus the pins themselves.
  const routeBounds = useMemo(() => {
    const pts = [...coords.map(([lng, lat]) => ({ lat, lng })), ...waypoints];
    return pts.length ? bounds(pts) : undefined;
  }, [coords, waypoints]);

  // Keep the active pin in view: the 360° inset recentres, route maps only pan if it's off-screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const center: [number, number] = [active.lng, active.lat];
    if (fit === "active") map.easeTo({ center, duration: 600 });
    else if (!map.getBounds()?.contains(center)) map.easeTo({ center, duration: 600 });
  }, [active, fit]);

  // Stable click handler, so a new onSelect prop from the parent doesn't re-render every marker.
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
  });
  const pick = useCallback((id: string) => onSelectRef.current?.(id), []);
  const clickable = !!onSelect;

  const initialViewState =
    fit === "active" && active
      ? { longitude: active.lng, latitude: active.lat, zoom: ACTIVE_ZOOM }
      : { bounds: routeBounds, fitBoundsOptions: { padding: 48 }, pitch: terrain ? 50 : 0 };

  return (
    <div className={cn("relative", className)}>
      <Map
        ref={mapRef}
        // Unmounted maps go back to a shared pool instead of being destroyed, so WebGL contexts
        // are capped at the number of maps on screen at once (and Strict Mode remounts are safe).
        reuseMaps
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAPBOX_STYLE}
        initialViewState={initialViewState}
        interactive={interactive}
        cooperativeGestures={interactive}
        attributionControl={interactive && controls === "top-right"}
        logoPosition="bottom-left"
        terrain={terrain ? { source: "mapbox-dem", exaggeration: 1.4 } : undefined}
        style={{ position: "absolute", inset: 0 }}
        onLoad={onLoad}
        onError={(e) => {
          // react-map-gl reports a failed constructor (no WebGL / context limit) with target null.
          // Anything else is a tile or style hiccup on a working map.
          if (!e.target) onError?.();
          else console.warn("Mapbox:", e.error?.message);
        }}
      >
        {terrain && (
          <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
        )}
        {line && (
          <Source id="route" type="geojson" data={line}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": forest, "line-width": 3, "line-dasharray": [2, 1.2], "line-opacity": safety ? 0.5 : 1 }}
            />
          </Source>
        )}

        {active && heading != null && (
          <Marker longitude={active.lng} latitude={active.lat} rotation={heading} rotationAlignment="map" pitchAlignment="map">
            <Cone size={fit === "active" ? 60 : 92} />
          </Marker>
        )}

        {waypoints.map((w) => (
          <WaypointMarker
            key={w.id}
            wp={w}
            on={w.id === activeId}
            dim={!!safety && !isSafety(w)}
            labels={!!labels}
            onPick={clickable ? pick : undefined}
          />
        ))}

        {interactive && controls === "top-left" && <AttributionControl position="bottom-left" compact />}
        {interactive && <NavigationControl position={controls} showCompass={!!terrain} />}
      </Map>
    </div>
  );
}

type WaypointMarkerProps = { wp: HikeWaypoint; on: boolean; dim: boolean; labels: boolean; onPick?: (id: string) => void };

/** Memoised so a step change re-renders only the two pins whose `on` flips, not every pin on every map. */
const WaypointMarker = memo(function WaypointMarker({ wp, on, dim, labels, onPick }: WaypointMarkerProps) {
  return (
    <Marker
      longitude={wp.lng}
      latitude={wp.lat}
      style={{ zIndex: on ? 6 : isSafety(wp) ? 3 : 2 }}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onPick?.(wp.id);
      }}
    >
      <span className={cn("relative block", onPick && "cursor-pointer")} title={wp.label}>
        <Pin type={wp.type} active={on} dimmed={dim} />
        {labels && !dim && <MapLabel>{wp.label}</MapLabel>}
      </span>
    </Marker>
  );
});
