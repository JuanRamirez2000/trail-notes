import { cn } from "@/lib/cn";

/**
 * Trailnotes contour-badge: a green field notebook with topo rings and an ochre pencil.
 * Geometry is expressed as fractions of `size` so it scales cleanly (32px header, 26px mobile).
 */
export function LogoBadge({ size = 32, className }: { size?: number; className?: string }) {
  const u = size / 100;
  const ring = "absolute box-border border-paper";
  const bw = Math.max(1.2, size * 0.04);
  return (
    <span className={cn("relative inline-block flex-none", className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className="absolute inset-0 box-border overflow-hidden bg-forest"
        style={{ borderRadius: `${12 * u}px ${20 * u}px ${20 * u}px ${12 * u}px`, borderLeft: `${9 * u}px solid rgb(0 0 0 / .35)` }}
      >
        <span className={ring} style={{ left: -20 * u, top: -20 * u, width: 90 * u, height: 75 * u, borderWidth: bw, borderRadius: "58% 42% 50% 50%/48% 56% 44% 52%" }} />
        <span className={ring} style={{ left: -5 * u, top: -5 * u, width: 60 * u, height: 45 * u, borderWidth: bw, borderRadius: "46% 54% 58% 42%/56% 44% 56% 44%" }} />
        <span className={ring} style={{ left: 40 * u, top: 50 * u, width: 55 * u, height: 45 * u, borderWidth: bw, borderRadius: "52% 48% 42% 58%/54% 46% 54% 46%" }} />
      </span>
      <span
        className="absolute bg-ochre shadow-[0_0_0_1px_var(--color-graphite)]"
        style={{ left: 78 * u, top: 28 * u, width: 10 * u, height: 70 * u, borderRadius: 3 * u, transform: "rotate(30deg)", transformOrigin: "0 0" }}
      />
    </span>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoBadge size={size} />
      <span className="font-display font-bold text-forest" style={{ fontSize: size * 0.75 }}>
        Trailnotes
      </span>
    </span>
  );
}
