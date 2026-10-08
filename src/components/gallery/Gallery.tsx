"use client";

import { useMemo, useState } from "react";
import type { HikeSummary } from "@/lib/content";
import { applyFilters, countHikes, EMPTY_FILTERS, type Filters } from "./filters";
import { FilterBar } from "./FilterBar";
import { HikeCard } from "./HikeCard";
import { HikesMap } from "./HikesMap";

export function Gallery({ hikes }: { hikes: HikeSummary[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = useMemo(() => applyFilters(hikes, filters), [hikes, filters]);

  return (
    <div className="flex flex-1 flex-col">
      <FilterBar value={filters} onChange={setFilters} shown={shown.length} total={hikes.length} />
      <div className="grid flex-1 lg:grid-cols-[500px_minmax(0,1fr)]">
        {/* Map stays fixed on desktop while cards scroll */}
        <div className="relative h-[300px] border-b border-line lg:sticky lg:top-0 lg:h-[calc(100dvh-65px)] lg:border-r lg:border-b-0">
          <HikesMap hikes={shown} selected={selected} onSelect={setSelected} className="absolute inset-0" />
        </div>
        <section className="bg-paper-deep px-4 py-4 sm:px-6 sm:py-5" aria-label="Hikes">
          <h2 className="mb-2.5 font-display text-lg font-bold sm:hidden">{countHikes(shown.length)}</h2>
          {shown.length === 0 ? (
            <p className="py-12 text-center text-bark">{hikes.length === 0 ? "No hikes have been published yet." : "No hikes match these filters."}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-[18px]">
              {shown.map((h, i) => (
                <HikeCard key={h.slug} hike={h} n={i + 1} selected={h.slug === selected} onHover={setSelected} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
