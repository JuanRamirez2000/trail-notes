"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { hasMapbox } from "@/components/map/config";
import { SketchMap } from "@/components/map/SketchMap";
import { Pin } from "@/components/ui/Pin";
import { cn } from "@/lib/cn";
import { compassLabel } from "@/lib/geo";
import type { HikeWaypoint, RouteCoords } from "@/lib/hike";
import { LEGEND_ORDER, PIN_STYLES, requiresSection } from "@/lib/pins";
import type { Photo, Track, WaypointType } from "@/lib/schemas";
import { addPin, aimPin, movePin, referencesTo, removePin, renamePin, reorderPin, snapToTrack, updatePin } from "./pin-ops";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false, loading: () => <p className="p-6 text-bark">Loading the map…</p> });

type Props = {
  /** The pins as JSON text (what's saved) and as parsed, derived pins (what's drawn). */
  waypoints: string;
  pins: HikeWaypoint[];
  mdx: string;
  track: Track | null;
  route: RouteCoords;
  onWaypoints: (json: string) => void;
  /** For a change that touches both the pins and the guide (renaming a pin). */
  onBoth: (json: string, mdx: string) => void;
};

const input = "w-full rounded-md border border-line-strong bg-card px-2 py-1.5 text-[15px] text-graphite";
const smallBtn = "cursor-pointer rounded border border-line-strong px-2 text-bark disabled:cursor-default disabled:opacity-30";

/**
 * The Pins view: the hike's pins on a map and in a list, with a form for the selected one.
 * Every change goes through pin-ops.ts and comes back as new pins JSON, saved like any other edit.
 */
export function PinsView({ waypoints, pins, mdx, track, route, onWaypoints, onBoth }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pins[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const selected = pins.find((p) => p.id === selectedId) ?? null;
  const showMap = hasMapbox && !mapFailed;
  // `pins` carry the measured mileage; whether a pin has its own override is only in the JSON as written.
  const overrides = useMemo(() => {
    const map = new Map<string, number>();
    try {
      for (const w of (JSON.parse(waypoints) as { waypoints: { id: string; mile?: unknown }[] }).waypoints) if (typeof w.mile === "number") map.set(w.id, w.mile);
    } catch {
      // invalid JSON never reaches this view
    }
    return map;
  }, [waypoints]);

  const add = (at: { lat: number; lng: number }) => {
    const { json, id } = addPin(waypoints, at, track);
    onWaypoints(json);
    setSelectedId(id);
    setAdding(false);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[45dvh_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
      <div className="relative min-h-0 border-b border-line lg:border-r lg:border-b-0">
        {showMap ? (
          <PinMap
            pins={pins}
            route={route}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, to) => onWaypoints(movePin(waypoints, id, to, track))}
            onAim={(id, at) => onWaypoints(aimPin(waypoints, id, at))}
            adding={adding}
            onAdd={add}
            onError={() => setMapFailed(true)}
          />
        ) : (
          <>
            <SketchMap waypoints={pins} route={route} activeId={selectedId} labels onSelect={setSelectedId} className="absolute inset-0" />
            <p className="absolute inset-x-3 bottom-3 rounded-lg border border-line bg-card px-3 py-2 text-sm text-bark">
              The interactive map isn&rsquo;t available here, so pins can&rsquo;t be dragged. You can still edit them in the form, including their position.
            </p>
          </>
        )}
        {showMap && (
          <>
            <button
              type="button"
              aria-pressed={adding}
              onClick={() => setAdding((v) => !v)}
              className={cn("absolute top-3 left-3 cursor-pointer rounded-lg border-2 px-3.5 py-1 shadow-sketch", adding ? "border-forest bg-forest text-paper" : "border-forest bg-highlight text-graphite")}
            >
              {adding ? "Click the map to place the pin · Cancel" : "＋ Add a pin"}
            </button>
            {/* At the bottom, clear of the pins (routes usually run up the map) and above Mapbox's logo. */}
            <span className="pointer-events-none absolute bottom-9 left-3 max-w-[calc(100%-1.5rem)] rounded-md border border-line bg-card/90 px-2 py-0.5 text-[13px] text-bark">
              Drag a pin to move it{track ? "; near the trail it snaps onto it" : ""}. Drag the yellow dot to aim the photo.
            </span>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-col bg-paper-deep">
        <div className="border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">PINS · {pins.length}, IN ROUTE ORDER</div>
        <ol className="max-h-[38%] min-h-[96px] flex-none overflow-y-auto border-b border-line" aria-label="Pins in route order">
          {pins.map((w, i) => (
            <li key={w.id} className={cn("flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-b-0", w.id === selectedId ? "bg-highlight" : "bg-card")}>
              <button type="button" onClick={() => setSelectedId(w.id)} aria-current={w.id === selectedId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                <Pin type={w.type} size={20} />
                <span className="min-w-0 flex-1 truncate">{w.label}</span>
                <span className="flex-none text-sm text-bark">{w.mile.toFixed(1)} mi</span>
              </button>
              <button type="button" className={smallBtn} disabled={i === 0} onClick={() => onWaypoints(reorderPin(waypoints, w.id, -1))} aria-label={`Move ${w.label} earlier`}>
                ↑
              </button>
              <button type="button" className={smallBtn} disabled={i === pins.length - 1} onClick={() => onWaypoints(reorderPin(waypoints, w.id, 1))} aria-label={`Move ${w.label} later`}>
                ↓
              </button>
            </li>
          ))}
          {pins.length === 0 && <li className="px-3 py-3 text-bark">No pins yet. Use &ldquo;Add a pin&rdquo; on the map.</li>}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <PinForm
              key={selected.id}
              pin={selected}
              pins={pins}
              track={track}
              references={referencesTo(mdx, selected.id)}
              mileOverride={overrides.get(selected.id)}
              onChange={(patch) => onWaypoints(updatePin(waypoints, selected.id, patch))}
              onRename={(nextId) => {
                const r = renamePin(waypoints, mdx, selected.id, nextId);
                if (r.ok) {
                  onBoth(r.json, r.mdx);
                  setSelectedId(nextId);
                }
                return r.ok ? null : r.problem;
              }}
              onRemove={() => {
                onWaypoints(removePin(waypoints, selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <p className="px-4 py-3.5 text-[15px] text-bark">Select a pin on the map or in the list to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

type FormProps = {
  pin: HikeWaypoint;
  pins: HikeWaypoint[];
  track: Track | null;
  /** How many blocks in the guide point at this pin. */
  references: number;
  /** The pin's own mileage, if the author set one instead of having it measured. */
  mileOverride?: number;
  onChange: (patch: Record<string, unknown>) => void;
  /** Returns a problem to show, or null if the rename went through. */
  onRename: (id: string) => string | null;
  onRemove: () => void;
};

function PinForm({ pin, pins, track, references, mileOverride, onChange, onRename, onRemove }: FormProps) {
  const [id, setId] = useState(pin.id);
  const [idProblem, setIdProblem] = useState<string | null>(null);
  // Photos already uploaded for this hike, as far as the pins know them.
  const photos = pins.filter((p) => p.photo).map((p) => ({ label: p.label, photo: p.photo as Photo }));
  const style = PIN_STYLES[pin.type];
  const offTrack = track ? !snapToTrack(pin, track).snapped : false;

  const num = (v: string) => (v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

  return (
    <form className="flex flex-col gap-3.5 px-4 py-3.5" onSubmit={(e) => e.preventDefault()}>
      <div className="font-display text-[19px] leading-tight font-bold">{pin.label}</div>

      <Field id="pin-type" label="Type" hint={requiresSection(pin.type) ? "A numbered step: it always gets a section in the guide." : "Optional: it only gets a section if you add one."}>
        <select id="pin-type" className={input} value={pin.type} onChange={(e) => onChange({ type: e.target.value as WaypointType })}>
          {LEGEND_ORDER.map((t) => (
            <option key={t} value={t}>
              {PIN_STYLES[t].label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="pin-label" label="Map label" hint="Short, shown next to the pin.">
        <input id="pin-label" className={input} value={pin.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>

      <Field id="pin-title" label="Section title" hint="The instruction for this part of the trail.">
        <input id="pin-title" className={input} value={pin.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>

      <Field id="pin-caption" label="Caption">
        <textarea id="pin-caption" rows={3} className={input} value={pin.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
      </Field>

      {(style.safety || pin.note) && (
        <Field id="pin-note" label="Safety note" hint="Shown in the Safety points list, e.g. “seasonal, filter water”.">
          <input id="pin-note" className={input} value={pin.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} />
        </Field>
      )}

      <Field id="pin-photo" label="Photo" hint="Photos are added with pnpm ingest for now; here you can move one between pins or take it off.">
        <select
          id="pin-photo"
          className={input}
          value={pin.photo?.key ?? ""}
          onChange={(e) => onChange({ photo: photos.find((p) => p.photo.key === e.target.value)?.photo })}
        >
          <option value="">No photo</option>
          {photos.map((p) => (
            <option key={p.photo.key} value={p.photo.key}>
              {p.photo.key.split("/")[1]} (on {p.label})
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="pin-heading"
        label="Photo direction"
        hint={pin.heading == null ? "Not set. Enter degrees (0 = north), or set it and drag the yellow dot on the map." : `Facing ${compassLabel(pin.heading)}. Drag the yellow dot on the map to aim it.`}
      >
        <div className="flex gap-2">
          <input
            id="pin-heading"
            type="number"
            min={0}
            max={359.9}
            step="any"
            className={input}
            value={pin.heading ?? ""}
            placeholder="Not set"
            onChange={(e) => {
              const v = num(e.target.value);
              onChange(v === undefined ? { heading: undefined, headingSource: undefined } : { heading: ((v % 360) + 360) % 360, headingSource: "manual" });
            }}
          />
          {pin.heading == null ? (
            <button type="button" className="flex-none cursor-pointer rounded-lg border border-line bg-card px-3" onClick={() => onChange({ heading: 0, headingSource: "manual" })}>
              Set
            </button>
          ) : (
            <button type="button" className="flex-none cursor-pointer rounded-lg border border-line-strong px-3 text-bark" onClick={() => onChange({ heading: undefined, headingSource: undefined })}>
              Clear
            </button>
          )}
        </div>
      </Field>

      <fieldset>
        <legend className="mb-[3px] text-[13px] text-bark">Position</legend>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Latitude" type="number" step="any" className={input} value={pin.lat} onChange={(e) => num(e.target.value) !== undefined && onChange({ lat: num(e.target.value) })} />
          <input aria-label="Longitude" type="number" step="any" className={input} value={pin.lng} onChange={(e) => num(e.target.value) !== undefined && onChange({ lng: num(e.target.value) })} />
        </div>
        <span className="mt-[3px] block text-[13px] text-bark">
          {pin.mile.toFixed(2)} mi along the route.{offTrack ? " This pin is off the recorded trail." : track ? " On the recorded trail." : ""}
        </span>
      </fieldset>

      <Field id="pin-mile" label="Trail mileage override" hint="Leave empty to measure it along the route.">
        <input id="pin-mile" type="number" min={0} step="any" className={input} value={mileOverride ?? ""} placeholder={pin.mile.toFixed(2)} onChange={(e) => onChange({ mile: num(e.target.value) })} />
      </Field>

      <Field id="pin-id" label="Id" hint={references ? `Used by ${references} block${references > 1 ? "s" : ""} in the guide; renaming updates ${references > 1 ? "them" : "it"} too.` : "How blocks in the guide refer to this pin."} problem={idProblem}>
        <div className="flex gap-2">
          <input id="pin-id" className={`${input} font-mono`} value={id} onChange={(e) => setId(e.target.value)} />
          <button type="button" disabled={id === pin.id} className="flex-none cursor-pointer rounded-lg border border-line bg-card px-3 disabled:cursor-default disabled:opacity-40" onClick={() => setIdProblem(onRename(id.trim()))}>
            Rename
          </button>
        </div>
      </Field>

      <div className="border-t border-dashed border-line-strong pt-3">
        <button type="button" disabled={references > 0} onClick={onRemove} className="cursor-pointer rounded-lg border border-line-strong px-3 py-0.5 text-bark disabled:cursor-default disabled:opacity-40">
          Delete pin
        </button>
        {references > 0 && <span className="mt-1 block text-[13px] text-bark">Remove its block from the guide (Write view) first; the guide can&rsquo;t point at a pin that doesn&rsquo;t exist.</span>}
      </div>
    </form>
  );
}

function Field({ id, label, hint, problem, children }: { id: string; label: string; hint?: string; problem?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-[3px] block text-[13px] text-bark">
        {label}
      </label>
      {children}
      {problem && <span className="mt-[3px] block text-[13px] text-pin-bailout">{problem}</span>}
      {hint && <span className="mt-[3px] block text-[13px] text-bark">{hint}</span>}
    </div>
  );
}
