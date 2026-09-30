import Link from "next/link";
import { Photo } from "@/components/ui/Photo";
import type { HikeSummary } from "@/lib/content";
import { DIFFICULTY_LABEL, formatMiles } from "@/lib/format";

export function HikePopup({ hike }: { hike: HikeSummary }) {
  return (
    <Link href={`/hikes/${hike.slug}`} className="block w-[190px] text-graphite no-underline hover:text-graphite">
      <Photo photoKey={hike.cover} variant="thumb" alt="" sizes="190px" className="h-[54px]" />
      <span className="block px-2.5 py-1.5 text-[15px] leading-snug">
        {hike.title}
        <br />
        <span className="text-caption text-bark">
          {formatMiles(hike.distanceMi)} · {DIFFICULTY_LABEL[hike.difficulty]} · View guide →
        </span>
      </span>
    </Link>
  );
}
