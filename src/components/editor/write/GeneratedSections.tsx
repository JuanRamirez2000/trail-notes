"use client";

import { useMemo } from "react";
import type { HikeWaypoint } from "@/lib/hike";
import { PIN_STYLES } from "@/lib/pins";
import { missingSections, type MissingSection } from "./missing-sections";

const REQUIRED = Object.values(PIN_STYLES)
  .filter((s) => s.section === "required")
  .map((s) => s.label.toLowerCase());

/**
 * Pins whose section the page writes on its own (a `<Step auto>` from the pin's title, photo
 * and caption): the Write view can't show those, so they're listed above the document, each
 * with a button that writes the section into the guide where the page shows it.
 */
export function GeneratedSections({ body, waypoints, onWrite }: { body: string; waypoints: HikeWaypoint[]; onWrite: (section: MissingSection) => void }) {
  const missing = useMemo(() => missingSections(body, waypoints), [body, waypoints]);
  if (!missing.length) return null;
  const mile = new Map(waypoints.map((w) => [w.id, w.mile]));
  return (
    <section aria-labelledby="generated-sections" className="mx-auto mt-5 w-[calc(100%-48px)] max-w-[752px] rounded-lg border-2 border-dashed border-line-strong bg-paper-deep px-4 py-3">
      <h2 id="generated-sections" className="font-display text-[17px] font-bold text-forest">
        {missing.length === 1 ? "1 section is" : `${missing.length} sections are`} added to the page for you
      </h2>
      <p className="mt-0.5 text-[15px] text-bark">
        Every {REQUIRED.slice(0, -1).join(", ")} and {REQUIRED.at(-1)} pin gets a section. These pins don&rsquo;t have one written, so the page shows their title, photo and caption.
        Write one to say more.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {missing.map((s) => (
          <li key={s.waypoint.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-card px-3 py-1.5">
            <span className="flex-1">
              <strong className="text-graphite">{s.waypoint.title}</strong>{" "}
              <span className="text-[13px] text-bark">
                {PIN_STYLES[s.waypoint.type].label} pin, mile {(mile.get(s.waypoint.id) ?? 0).toFixed(1)}
              </span>
            </span>
            <button type="button" onClick={() => onWrite(s)} className="cursor-pointer rounded-lg border border-line-strong bg-paper px-3 py-0.5 text-graphite">
              Write this section
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
