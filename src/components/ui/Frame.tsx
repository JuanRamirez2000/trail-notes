"use client";

import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type FrameProps = {
  /** What kind of block this is, in the label. Without one the label shows an empty box. */
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  /** Shown in the label, after the meta (e.g. "Step 2 of 6"). */
  actions?: ReactNode;
  /** A caption under the frame. It may hold a button or two, but it sits outside the box. */
  footer?: ReactNode;
  expandable?: boolean;
  /** The body is a picture or a map that should run to the frame's edges, under the label. */
  bleed?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
  active?: boolean;
  children: ReactNode;
};

/**
 * Full-screen for a block: Escape or the backdrop closes it, and the page behind doesn't scroll.
 * Shared by the frame and by the blocks that draw their own edges (the route map).
 */
export function useExpand() {
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
  return {
    expanded,
    toggle: () => setExpanded((v) => !v),
    backdrop: expanded ? <div className="fixed inset-0 z-40 bg-graphite/40" onClick={() => setExpanded(false)} /> : null,
  };
}

/** The square button that floats in a block's corner (expand, and whatever a block adds). */
export const floatingButton = "flex cursor-pointer items-center justify-center rounded-md border border-line bg-card text-bark hover:text-graphite";

/**
 * The frame guide blocks share (design: Trailnotes Components, "Shared frame"): a label tab that
 * sits on the top edge, the body edge to edge inside a rounded box, actions floating in the
 * body's corner, and the footer as a plain caption line underneath.
 */
export function Frame({ icon: Icon, title, meta, actions, footer, expandable = true, bleed, className, bodyClassName, id, active, children }: FrameProps) {
  const { expanded, toggle, backdrop } = useExpand();

  return (
    <>
      {backdrop}
      <section id={id} className={cn("not-prose relative my-[22px] flex scroll-mt-24 flex-col pt-3", expanded && "fixed inset-3 z-50 my-0 sm:inset-8", className)}>
        <header className="absolute top-0 left-3.5 z-[2] flex max-w-[calc(100%-1.75rem)] items-center gap-[7px] rounded-md border border-line-strong bg-card py-[3px] pr-2.5 pl-[7px] font-display text-[15px] leading-[18px] font-bold">
          {Icon ? <Icon size={14} strokeWidth={2} className="flex-none text-forest" aria-hidden /> : <span className="size-3.5 flex-none rounded-[3px] border-[1.5px] border-forest" aria-hidden />}
          <span className="truncate">{title}</span>
          {meta && <span className="truncate font-sans text-[13px] font-normal text-bark">{meta}</span>}
          {actions && <span className="flex-none font-sans text-[13px] font-normal text-bark">{actions}</span>}
        </header>
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border bg-card transition-shadow",
            active ? "border-forest shadow-[0_0_0_1px_var(--color-forest)]" : "border-line-strong",
            // Room for the label, which overlaps the top edge, unless the body is meant to run under it.
            !bleed && "pt-3.5",
          )}
        >
          <div className={cn("relative min-h-0", expanded && "flex-1 *:h-full!", bodyClassName)}>{children}</div>
          {expandable && (
            <button type="button" onClick={toggle} className={cn(floatingButton, "absolute top-2 right-2 z-[2] size-7")} aria-label={expanded ? "Collapse" : "Expand"}>
              {expanded ? "✕" : "⤢"}
            </button>
          )}
        </div>
        {footer && <footer className="px-1.5 pt-1.5 text-sm text-bark">{footer}</footer>}
      </section>
    </>
  );
}
