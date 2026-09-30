"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/cn";
import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox";
import { Pin } from "@/components/ui/Pin";
import { bounds, routeLine } from "@/lib/geo";
import { isSafety } from "@/lib/hike";
import { MAPBOX_STYLE, MAPBOX_TOKEN, useCssColor } from "./config";
import { Cone } from "./Cone";
import { MapLabel } from "./SketchMap";
import type { TrailMapProps } from "./types";

const ACTIVE_ZOOM = 15.5;

export default function MapboxTrailMap({
  waypoints,
  activeId,
  heading,
  labels,
  safety,
  onSelect,
  interactive = true,
  terrain,
  fit = "route",
  className,
  onLoad,
}: TrailMapProps) {
  const mapRef = useRef<MapRef>(null);
  const forest = useCssColor("--color-forest");
  const active = waypoints.find((w) => w.id === activeId);
  const line = useMemo(() => routeLine(waypoints), [waypoints]);
  const routeBounds = useMemo(() => (waypoints.length ? bounds(waypoints) : undefined), [waypoints]);

  // Keep the active pin in view: the 360° inset recentres, route maps only pan if it's off-screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const center: [number, number] = [active.lng, active.lat];
    if (fit === "active") map.easeTo({ center, duration: 600 });
    else if (!map.getBounds()?.contains(center)) map.easeTo({ center, duration: 600 });
  }, [active, fit]);

  const initialViewState =
    fit === "active" && active
      ? { longitude: active.lng, latitude: active.lat, zoom: ACTIVE_ZOOM }
      : { bounds: routeBounds, fitBoundsOptions: { padding: 48 }, pitch: terrain ? 50 : 0 };

  return (
    <div className={cn("relative", className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAPBOX_STYLE}
        initialViewState={initialViewState}
        interactive={interactive}
        cooperativeGestures={interactive}
        attributionControl={interactive}
        logoPosition="bottom-left"
        terrain={terrain ? { source: "mapbox-dem", exaggeration: 1.4 } : undefined}
        style={{ position: "absolute", inset: 0 }}
        onLoad={onLoad}
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

        {waypoints.map((w) => {
          const dim = safety && !isSafety(w);
          const on = w.id === activeId;
          return (
            <Marker
              key={w.id}
              longitude={w.lng}
              latitude={w.lat}
              style={{ zIndex: on ? 6 : isSafety(w) ? 3 : 2 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect?.(w.id);
              }}
            >
              <span className={cn("relative block", onSelect && "cursor-pointer")} title={w.label}>
                <Pin type={w.type} active={on} dimmed={dim} />
                {labels && !dim && <MapLabel>{w.label}</MapLabel>}
              </span>
            </Marker>
          );
        })}

        {interactive && <NavigationControl position="top-right" showCompass={!!terrain} />}
      </Map>
    </div>
  );
}
