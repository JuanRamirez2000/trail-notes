import { cn } from "@/lib/cn";

/** Numbered trailhead pin on the gallery map; ochre when selected. */
export function HikePin({ n, selected }: { n: number; selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[30px] items-center justify-center rounded-full border-2 border-card font-mono text-[13px] font-semibold",
        selected ? "bg-ochre text-graphite" : "bg-forest text-paper",
      )}
    >
      {n}
    </span>
  );
}
