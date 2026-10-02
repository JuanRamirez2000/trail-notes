"use client";

import { useHike } from "@/lib/hike-store";
import type { Essentials } from "@/lib/schemas";

const ROWS: { key: Exclude<keyof Essentials, "hazards">; label: string }[] = [
  { key: "permit", label: "Permit" },
  { key: "parking", label: "Parking" },
  { key: "facilities", label: "Facilities" },
  { key: "water", label: "Water" },
  { key: "dogs", label: "Dogs" },
  { key: "cellSignal", label: "Cell signal" },
];

/**
 * `<BeforeYouGo />` in MDX: the hike's frontmatter `essentials`, wherever the guide places it.
 * A guide that doesn't place it gets one at the top (lib/mdx/remark-default-blocks.ts).
 */
export function BeforeYouGo(_props: { auto?: boolean }) {
  return <EssentialsCard essentials={useHike((s) => s.essentials)} />;
}

/** Trip-planning facts. Renders nothing if absent. */
export function EssentialsCard({ essentials }: { essentials?: Essentials }) {
  if (!essentials) return null;
  const rows = ROWS.filter((r) => essentials[r.key]);
  if (!rows.length && !essentials.hazards?.length) return null;

  return (
    <section aria-labelledby="before-you-go" className="mt-[22px] overflow-hidden rounded-[10px] border border-line bg-card">
      <h2 id="before-you-go" className="border-b border-line bg-frame px-3 py-2 font-display text-lg font-bold text-forest">
        Before you go
      </h2>
      <dl className="grid gap-x-6 gap-y-2.5 px-3.5 py-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className="text-caption font-semibold tracking-[.06em] text-bark uppercase">{r.label}</dt>
            <dd className="leading-snug">{essentials[r.key]}</dd>
          </div>
        ))}
      </dl>
      {essentials.hazards?.length ? (
        <div className="border-t border-dashed border-line-strong px-3.5 py-3">
          <div className="text-caption font-semibold tracking-[.06em] text-pin-bailout uppercase">Hazards</div>
          <ul className="mt-1 list-disc pl-5 leading-snug">
            {essentials.hazards.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
