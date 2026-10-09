"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DIFFICULTY_LABEL } from "@/lib/format";
import { DIFFICULTIES } from "@/lib/schemas";
import { countHikes, DISTANCE_MAX, ELEVATION_MAX, EMPTY_FILTERS, isActive, type Filters } from "./filters";
import { RangeSlider } from "./RangeSlider";

type Props = { value: Filters; onChange: (f: Filters) => void; shown: number; total: number };

export function FilterBar({ value, onChange, shown, total }: Props) {
  const dirty = Object.values(isActive).some((fn) => fn(value));
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-7 sm:py-4">
      {/* On a phone the heading is for screen readers only: the filters take the row. */}
      <h1 className="mr-3 font-display text-[26px] font-bold max-sm:sr-only">Find a hike</h1>
      <Dropdown label="Difficulty" active={isActive.difficulty(value)}>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-2">Difficulty</legend>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-forest"
                checked={value.difficulty.includes(d)}
                onChange={(e) => set("difficulty", e.target.checked ? [...value.difficulty, d] : value.difficulty.filter((x) => x !== d))}
              />
              {DIFFICULTY_LABEL[d]}
            </label>
          ))}
        </fieldset>
      </Dropdown>
      <Dropdown label="Distance" active={isActive.distance(value)}>
        <RangeSlider label="Distance (round trip)" min={0} max={DISTANCE_MAX} step={0.5} value={value.distance} onChange={(v) => set("distance", v)} format={(n) => `${n} mi`} />
      </Dropdown>
      <Dropdown label="Elevation" active={isActive.elevation(value)}>
        <RangeSlider label="Elevation gain" min={0} max={ELEVATION_MAX} step={100} value={value.elevation} onChange={(v) => set("elevation", v)} format={(n) => `${n.toLocaleString()} ft`} />
      </Dropdown>
      {dirty && (
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="cursor-pointer text-bark underline">
          Clear
        </button>
      )}
      <span className="ml-auto text-bark">
        {shown === total ? countHikes(total) : `${shown} of ${countHikes(total)}`}
      </span>
    </div>
  );
}

function Dropdown({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "cursor-pointer rounded-full px-3.5 py-0.5",
          active ? "border-2 border-forest bg-highlight" : "border border-line-strong",
        )}
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-[260px] rounded-[10px] border border-line bg-card px-3.5 py-3 shadow-sketch">
          {children}
        </div>
      )}
    </div>
  );
}
