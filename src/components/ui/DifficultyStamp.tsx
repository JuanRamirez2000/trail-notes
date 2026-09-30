import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL } from "@/lib/format";
import type { Difficulty } from "@/lib/schemas";

const TILT: Record<Difficulty, string> = { easy: "-rotate-3", moderate: "rotate-2", hard: "-rotate-2", strenuous: "rotate-1" };

/** Ink-stamp difficulty badge: dashed outline with a slight tilt. */
export function DifficultyStamp({ level, className }: { level: Difficulty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border-2 border-dashed border-bark px-2 font-mono text-[11px] leading-[18px] font-semibold tracking-[.06em] text-bark uppercase",
        TILT[level],
        className,
      )}
    >
      {DIFFICULTY_LABEL[level]}
    </span>
  );
}
