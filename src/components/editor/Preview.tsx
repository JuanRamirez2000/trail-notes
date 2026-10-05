"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { proseComponents } from "@/components/mdx/prose";
import { mdxComponents } from "@/components/mdx/registry";
import { routeCoords } from "@/lib/hike";
import { HikeProvider } from "@/lib/hike-store";
import { essentialsSchema, type Track } from "@/lib/schemas";
import { compilePreview, parseWaypoints, type CompiledPreview } from "./compile";

type Props = {
  slug: string;
  mdx: string;
  waypoints: string;
  track: Track | null;
  /** Source offset of the selected component (see remark-source-markers), outlined in the preview. */
  selectedStart?: number;
  /** Called with a component's source offset when it's clicked in the preview. */
  onSelectComponent?: (start: number) => void;
};

export function Preview({ slug, mdx, waypoints, track, selectedStart, onSelectComponent }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deferredMdx = useDeferredValue(mdx);
  const [compiled, setCompiled] = useState<CompiledPreview | null>(null);
  const wp = useMemo(() => parseWaypoints(waypoints, track), [waypoints, track]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(
      () => compilePreview(deferredMdx, wp.ok ? wp.waypoints : null).then((r) => !cancelled && setCompiled(r)),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferredMdx, wp]);

  // Outline the selected component. Done on the DOM so moving the cursor doesn't recompile the preview.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll("[data-selected]")) el.removeAttribute("data-selected");
    if (selectedStart === undefined) return;
    const el = root.querySelector(`[data-src-start="${selectedStart}"]`);
    el?.setAttribute("data-selected", "");
    // Bring it into view when it was selected from the Markdown side (no-op if already visible).
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedStart, compiled]);

  if (!compiled) return <p className="p-6 text-bark">Compiling…</p>;
  return (
    <div
      ref={rootRef}
      className="editor-preview px-[22px] py-[18px]"
      onClick={(e) => {
        // Innermost component under the click; the component's own buttons and links still work.
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-src-start]");
        if (el) onSelectComponent?.(Number(el.dataset.srcStart));
      }}
    >
      {!compiled.ok && <ErrorBox title="MDX error" message={compiled.error} />}
      {!wp.ok && <ErrorBox title="waypoints.json" message={wp.error} />}
      {compiled.ok && (
        <>
          <h1 className="font-display text-[30px] leading-[34px] font-bold text-forest">{String(compiled.frontmatter.title ?? slug)}</h1>
          {/* Keyed on the JSON so edits to waypoints rebuild the shared store. */}
          <HikeProvider
            key={`${waypoints}\n${JSON.stringify(compiled.frontmatter.essentials ?? null)}`}
            slug={slug}
            waypoints={wp.ok ? wp.waypoints : []}
            route={routeCoords(wp.ok ? wp.waypoints : [], track)}
            essentials={essentialsSchema.safeParse(compiled.frontmatter.essentials).data}
          >
            <compiled.Content components={{ ...proseComponents, ...mdxComponents }} />
          </HikeProvider>
        </>
      )}
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="mb-4 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-3">
      <div className="font-semibold text-pin-bailout">{title}</div>
      <pre className="mt-1 font-mono text-xs whitespace-pre-wrap">{message}</pre>
    </div>
  );
}
