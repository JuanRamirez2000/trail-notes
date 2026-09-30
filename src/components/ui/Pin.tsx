import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";
import { PIN_STYLES } from "@/lib/pins";
import type { WaypointType } from "@/lib/schemas";

type Props = {
  type: WaypointType;
  /** Base size in px; safety pins render ~20% larger automatically. */
  size?: number;
  active?: boolean;
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Pin({ type, size = 22, active, dimmed, className, style }: Props) {
  const s = PIN_STYLES[type];
  const px = s.safety ? Math.round(size * 1.18) : size;
  return (
    <span
      className={cn(
        "box-border flex flex-none items-center justify-center border-2 border-white font-mono font-semibold text-white transition-opacity",
        s.safety ? "shadow-[var(--shadow-pin-halo)]" : "shadow-[var(--shadow-pin)]",
        active && "outline-2 outline-offset-3 outline-graphite",
        dimmed && "opacity-30",
        type === "start" && "text-paper",
        className,
      )}
      style={{ width: px, height: px, background: s.color, borderRadius: s.radius, fontSize: px * 0.5, ...style }}
      aria-label={s.label}
      role="img"
    >
      {s.glyph}
    </span>
  );
}
