import { cn } from "@/lib/cn";
import Link from "next/link";
import { DifficultyStamp } from "@/components/ui/DifficultyStamp";
import { Photo } from "@/components/ui/Photo";
import type { HikeSummary } from "@/lib/content";
import { formatFeet, formatMiles } from "@/lib/format";

type Props = {
  hike: HikeSummary;
  /** The card's number on the gallery map. Left out where there's no map (the landing page). */
  n?: number;
  selected?: boolean;
  onHover?: (slug: string | null) => void;
};

export function HikeCard({ hike, n, selected, onHover }: Props) {
  return (
    <Link
      href={`/hikes/${hike.slug}`}
      onMouseEnter={onHover && (() => onHover(hike.slug))}
      onFocus={onHover && (() => onHover(hike.slug))}
      className={cn(
        "flex overflow-hidden rounded-[10px] bg-card text-graphite no-underline hover:text-graphite sm:flex-col",
        selected ? "border-2 border-forest" : "border border-line",
      )}
    >
      <div className="relative w-[110px] flex-none border-r-[1.5px] border-line-strong sm:h-[140px] sm:w-auto sm:border-r-0 sm:border-b-[1.5px]">
        <Photo photoKey={hike.cover} variant="thumb" alt="" sizes="(min-width: 640px) 360px, 110px" className="absolute inset-0" />
        {n !== undefined && (
          <span className="absolute left-2 top-2 hidden size-[22px] items-center justify-center rounded-full border border-line bg-card text-[13px] sm:flex">
            {n}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 px-2.5 py-2 sm:px-3 sm:pt-2.5 sm:pb-3">
        <div className="truncate text-lg sm:text-xl">{hike.title}</div>
        <div className="text-caption text-bark sm:text-sm">{hike.region}</div>
        <div className="mt-1.5 flex items-center gap-2 text-sm sm:mt-2 sm:gap-3 sm:text-[15px]">
          <span>{formatMiles(hike.distanceMi)}</span>
          <span>↑ {formatFeet(hike.elevationGainFt)}</span>
          <DifficultyStamp level={hike.difficulty} className="ml-auto" />
        </div>
      </div>
    </Link>
  );
}
