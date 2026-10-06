"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useMemo, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox";
import { Cone } from "@/components/map/Cone";
import { MAPBOX_STYLE, MAPBOX_TOKEN, useCssColor } from "@/components/map/config";
import { MapLabel } from "@/components/map/SketchMap";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { bounds } from "@/lib/geo";
import type { HikeWaypoint, RouteCoords } from "@/lib/hike";

type LngLat = { lat: number; lng: number };

type Props = {
  pins: HikeWaypoint[];
  route: RouteCoords;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A pin was dropped somewhere new. */
  onMove: (id: string, to: LngLat) => void;
  /** The selected pin's direction handle was dragged to a spot. */
  onAim: (id: string, at: LngLat) => void;
  /** When set, the next click on the map adds a pin there. */
  adding: boolean;
  onAdd: (at: LngLat) => void;
  onError: () => void;
};

/** How far from its pin the direction handle sits, in screen pixels. */
const HANDLE_PX = 84;

/**
 * The pin editor's map: every pin is draggable, the selected pin shows its photo direction as
 * a cone with a handle to drag, and in "add" mode a click drops a new pin. It reports what the
 * author did; snapping to the track and updating the pins is the caller's job (pin-ops.ts).
 */
export default function PinMap({ pins, route, selectedId, onSelect, onMove, onAim, adding, onAdd, onError }: Props) {
  // Held in state (not a ref) because the handle's position is computed from the map while rendering.
  const [map, setMap] = useState<MapRef | null>(null);
  const forest = useCssColor("--color-forest");
  // The handle is placed in screen space, so it has to be recomputed whenever the map moves.
  const [, setMoves] = useState(0);
  const onMapMove = useCallback(() => setMoves((n) => n + 1), []);

  const line = useMemo(
    () => (route.length >= 2 ? { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route } } : null),
    [route],
  );
  // Fitted once, to the route and pins as they were when the map opened; edits don't re-frame it.
  const [initialBounds] = useState(() => {
    const pts = [...route.map(([lng, lat]) => ({ lat, lng })), ...pins];
    return pts.length ? bounds(pts) : undefined;
  });

  const selected = pins.find((p) => p.id === selectedId);
  const handle = (() => {
    if (!map || !selected || selected.heading == null) return null;
    const p = map.project([selected.lng, selected.lat]);
    const rad = ((selected.heading - map.getBearing()) * Math.PI) / 180;
    const at = map.unproject([p.x + Math.sin(rad) * HANDLE_PX, p.y - Math.cos(rad) * HANDLE_PX]);
    return { lng: at.lng, lat: at.lat };
  })();

  return (
    <Map
      ref={setMap}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={MAPBOX_STYLE}
      initialViewState={initialBounds ? { bounds: initialBounds, fitBoundsOptions: { padding: 64 } } : { longitude: -118.1, latitude: 34.26, zoom: 11 }}
      style={{ position: "absolute", inset: 0 }}
      cursor={adding ? "crosshair" : undefined}
      onMove={onMapMove}
      onLoad={onMapMove}
      onClick={(e) => {
        if (adding) onAdd({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        else onSelect(null);
      }}
      onError={(e) => {
        // A failed constructor (no WebGL) reports with no target; anything else is a tile hiccup.
        if (!e.target) onError();
      }}
    >
      {line && (
        <Source id="route" type="geojson" data={line}>
          <Layer id="route-line" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": forest, "line-width": 3, "line-dasharray": [2, 1.2] }} />
        </Source>
      )}

      {selected && selected.heading != null && (
        <Marker longitude={selected.lng} latitude={selected.lat} rotation={selected.heading} rotationAlignment="map" pitchAlignment="map" style={{ pointerEvents: "none" }}>
          <Cone size={HANDLE_PX} />
        </Marker>
      )}

      {pins.map((w) => {
        const on = w.id === selectedId;
        return (
          <Marker
            key={w.id}
            longitude={w.lng}
            latitude={w.lat}
            draggable
            style={{ zIndex: on ? 6 : 2 }}
            onDragStart={() => onSelect(w.id)}
            onDragEnd={(e) => onMove(w.id, { lat: e.lngLat.lat, lng: e.lngLat.lng })}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(w.id);
            }}
          >
            <span className="relative block cursor-grab active:cursor-grabbing" title={`${w.label}: drag to move`}>
              <Pin type={w.type} active={on} size={on ? 28 : 24} />
              <MapLabel>{w.label}</MapLabel>
            </span>
          </Marker>
        );
      })}

      {selected && handle && (
        <Marker longitude={handle.lng} latitude={handle.lat} draggable style={{ zIndex: 7 }} onDrag={(e) => onAim(selected.id, { lat: e.lngLat.lat, lng: e.lngLat.lng })} onClick={(e) => e.originalEvent.stopPropagation()}>
          <span
            title="Drag to set the direction the photo faces"
            className={cn("block size-5 cursor-grab rounded-full border-2 border-white bg-ochre shadow-[var(--shadow-pin)] active:cursor-grabbing")}
          />
        </Marker>
      )}

      <NavigationControl position="top-right" showCompass={false} />
    </Map>
  );
}
