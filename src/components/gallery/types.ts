import type { HikeSummary } from "@/lib/content";

export type HikesMapProps = {
  hikes: HikeSummary[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  className?: string;
};
