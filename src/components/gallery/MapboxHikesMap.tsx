"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/cn";
import { useEffect, useMemo, useRef } from "react";
import Map, { Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/mapbox";
import { MAPBOX_STYLE, MAPBOX_TOKEN } from "@/components/map/config";
import { bounds } from "@/lib/geo";
import { HikePin } from "./HikePin";
import { HikePopup } from "./HikePopup";
import type { HikesMapProps } from "./types";

export default function MapboxHikesMap({ hikes, selected, onSelect, className }: HikesMapProps) {
  const mapRef = useRef<MapRef>(null);
  const all = useMemo(() => hikes.map((h) => h.trailhead), [hikes]);
  const sel = hikes.find((h) => h.slug === selected);

  // Refit when filters change the visible set.
  useEffect(() => {
    if (!mapRef.current || all.length === 0) return;
    mapRef.current.fitBounds(bounds(all), { padding: 80, maxZoom: 11, duration: 600 });
  }, [all]);

  return (
    <div className={cn("relative", className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAPBOX_STYLE}
        initialViewState={all.length ? { bounds: bounds(all), fitBoundsOptions: { padding: 80, maxZoom: 11 } } : undefined}
        style={{ position: "absolute", inset: 0 }}
        onClick={() => onSelect(null)}
      >
        {hikes.map((h, i) => (
          <Marker
            key={h.slug}
            longitude={h.trailhead.lng}
            latitude={h.trailhead.lat}
            style={{ zIndex: h.slug === selected ? 10 : 1, cursor: "pointer" }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(h.slug);
            }}
          >
            <HikePin n={i + 1} selected={h.slug === selected} />
          </Marker>
        ))}
        {sel && (
          <Popup longitude={sel.trailhead.lng} latitude={sel.trailhead.lat} anchor="bottom" offset={22} closeButton={false} onClose={() => onSelect(null)}>
            <HikePopup hike={sel} />
          </Popup>
        )}
        <NavigationControl position="top-right" showCompass={false} />
      </Map>
    </div>
  );
}
