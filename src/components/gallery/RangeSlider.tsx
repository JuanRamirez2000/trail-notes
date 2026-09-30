"use client";

import type { Range } from "./filters";

type Props = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: Range;
  onChange: (v: Range) => void;
  format: (n: number) => string;
};

/** Two stacked native range inputs: accessible and keyboard-friendly without a slider library. */
export function RangeSlider({ label, min, max, step, value: [lo, hi], onChange, format }: Props) {
  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 -top-[5px] h-4 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-forest [&::-webkit-slider-thumb]:bg-card [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-forest [&::-moz-range-thumb]:bg-card";
  return (
    <div>
      <div className="mb-3 flex justify-between gap-4">
        <span>{label}</span>
        <span className="text-bark">
          {format(lo)} – {hi >= max ? `${format(max)}+` : format(hi)}
        </span>
      </div>
      <div className="relative mx-1.5 mb-4 h-1.5 rounded-full bg-line">
        <div className="absolute inset-y-0 rounded-full bg-forest" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" aria-label={`${label} minimum`} min={min} max={max} step={step} value={lo} onChange={(e) => onChange([Math.min(+e.target.value, hi), hi])} className={thumb} />
        <input type="range" aria-label={`${label} maximum`} min={min} max={max} step={step} value={hi} onChange={(e) => onChange([lo, Math.max(+e.target.value, lo)])} className={thumb} />
      </div>
      <div className="flex justify-between text-sm text-bark">
        <span>{format(min)}</span>
        <span>{format(max)}+</span>
      </div>
    </div>
  );
}
