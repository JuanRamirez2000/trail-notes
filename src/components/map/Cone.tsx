import { cn } from "@/lib/cn";

/**
 * View-direction wedge. The element is a square centred on the waypoint with the wedge
 * in its top half, so rotating around the centre rotates around the pin.
 */
export function Cone({ size = 92, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none relative", className)} style={{ width: size * 2, height: size * 2 }}>
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: size,
          height: size,
          clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          background: "linear-gradient(to top, color-mix(in srgb, var(--color-ochre) 80%, transparent), color-mix(in srgb, var(--color-ochre) 8%, transparent))",
        }}
      />
    </div>
  );
}
