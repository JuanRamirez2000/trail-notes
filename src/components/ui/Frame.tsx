"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState, type ReactNode } from "react";

type FrameProps = {
  title: ReactNode;
  meta?: ReactNode;
  /** Right side of the header, before the expand button. */
  actions?: ReactNode;
  footer?: ReactNode;
  expandable?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
  active?: boolean;
  children: ReactNode;
};

/**
 * Shared frame every guide component renders inside (design: "every block shares one frame").
 * Header: icon · title · meta · expand. Body: full-bleed. Footer: optional, dashed divider.
 */
export function Frame({ title, meta, actions, footer, expandable = true, className, bodyClassName, id, active, children }: FrameProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  return (
    <>
      {expanded && <div className="fixed inset-0 z-40 bg-graphite/40" onClick={() => setExpanded(false)} />}
      <section
        id={id}
        className={cn(
          "not-prose my-[22px] flex scroll-mt-24 flex-col overflow-hidden rounded-[10px] border bg-card transition-shadow",
          active ? "border-forest shadow-[0_0_0_1px_var(--color-forest)]" : "border-line",
          expanded && "fixed inset-3 z-50 my-0 sm:inset-8",
          className,
        )}
      >
        <header className="flex min-h-10 items-center gap-2 border-b border-line bg-frame px-3 py-2 text-base">
          <span className="size-[18px] flex-none rounded border border-line" aria-hidden />
          <span className="truncate">{title}</span>
          {meta && <span className="truncate text-sm text-bark">{meta}</span>}
          <span className="ml-auto flex items-center gap-3 text-bark">
            {actions}
            {expandable && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="cursor-pointer px-1 hover:text-graphite"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? "✕" : "⤢"}
              </button>
            )}
          </span>
        </header>
        <div className={cn("relative", expanded && "min-h-0 flex-1 *:h-full!", bodyClassName)}>{children}</div>
        {footer && <footer className="border-t border-dashed border-line-strong px-3 py-2 text-sm">{footer}</footer>}
      </section>
    </>
  );
}
