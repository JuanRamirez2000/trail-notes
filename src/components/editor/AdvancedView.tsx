"use client";

import type { EditorView } from "@codemirror/view";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { registry, type RegisteredComponent } from "@/components/mdx/registry";
import { cn } from "@/lib/cn";
import type { HikeWaypoint } from "@/lib/hike";
import type { Track } from "@/lib/schemas";
import { ComponentSettings } from "./ComponentSettings";
import { findComponentAt, serializeOpeningTag } from "./jsx-source";
import { InsertMenu } from "./InsertMenu";
import { Preview } from "./Preview";
import type { Cursor } from "./SourceEditor";

const SourceEditor = dynamic(() => import("./SourceEditor"), {
  ssr: false,
  loading: () => <div className="p-4 font-mono text-sm text-bark">Loading editor…</div>,
});

type Props = {
  slug: string;
  mdx: string;
  waypoints: string;
  onMdx: (mdx: string) => void;
  onWaypoints: (waypoints: string) => void;
  track: Track | null;
  parsedWaypoints: HikeWaypoint[];
  onCursor: (cursor: Cursor) => void;
};
type Tab = "mdx" | "json";
type Mode = "split" | "editor" | "preview";

/**
 * The raw view: the guide's Markdown source and the pins' JSON, with a live preview and the
 * settings column (design 3a). Everything the Write and Details views do can be done here by
 * hand; it's the fallback for anything they can't express yet.
 */
export function AdvancedView({ slug, mdx, waypoints, onMdx, onWaypoints, track, parsedWaypoints, onCursor }: Props) {
  const [tab, setTab] = useState<Tab>("mdx");
  const [mode, setMode] = useState<Mode>("split");
  const [offset, setOffset] = useState(0);
  const viewRef = useRef<EditorView | null>(null);
  const onReady = useCallback((v: EditorView) => (viewRef.current = v), []);
  const handleCursor = useCallback(
    (c: Cursor) => {
      setOffset(c.offset);
      onCursor(c);
    },
    [onCursor],
  );

  // Codemirror is the source of truth for selection; edits go through its transaction API.
  const replaceSelection = (fn: (sel: string) => string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const text = fn(view.state.sliceDoc(from, to));
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  };

  const insertComponent = (name: RegisteredComponent) => {
    const written = new Set([...mdx.matchAll(/<Step\s+waypoint="([^"]+)"/g)].map((m) => m[1]));
    const list = parsedWaypoints;
    const pick =
      name === "Step"
        ? list.find((w) => w.stepIndex !== null && !written.has(w.id)) ?? list.find((w) => !written.has(w.id))
        : name === "PanoViewer"
          ? list.find((w) => w.photo?.kind === "pano") ?? list.find((w) => w.type === "viewpoint")
          : list.find((w) => w.photo?.kind === "flat" && w.type !== "start") ?? list[0];
    const snippet = registry[name].snippet.replace("{{waypoint}}", pick?.id ?? "waypoint-id");
    if (tab !== "mdx") setTab("mdx");
    // Wait a tick if we just switched tabs so the MDX editor is mounted.
    setTimeout(() => replaceSelection(() => `\n${snippet}\n`), tab === "mdx" ? 0 : 50);
  };

  // Component under the cursor in the MDX source, edited through the settings panel.
  const selected = useMemo(() => (tab === "mdx" && mode !== "preview" ? findComponentAt(mdx, offset) : null), [tab, mode, mdx, offset]);
  // Rewrite only the opening tag, as a CodeMirror transaction so the cursor and undo history stay intact.
  const updateSelectedProps = (props: Record<string, unknown>) => {
    const view = viewRef.current;
    if (!view || !selected) return;
    const tag = serializeOpeningTag(selected.name, props, selected.raw, selected.selfClosing);
    view.dispatch({ changes: { from: selected.start, to: selected.openEnd, insert: tag } });
  };
  const duplicateSelected = () => {
    const view = viewRef.current;
    if (!view || !selected) return;
    view.dispatch({ changes: { from: selected.end, insert: `\n\n${mdx.slice(selected.start, selected.end)}` } });
  };
  const removeSelected = () => {
    const view = viewRef.current;
    if (!view || !selected) return;
    // Take the blank line after it too, so no gap is left behind.
    const after = /^\n{1,2}/.exec(mdx.slice(selected.end))?.[0].length ?? 0;
    view.dispatch({ changes: { from: selected.start, to: selected.end + after, insert: "" } });
  };
  // Clicking a component in the preview puts the cursor inside its tag, which selects it.
  const selectFromPreview = (start: number) => {
    const go = () => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ selection: { anchor: Math.min(start + 1, view.state.doc.length) }, scrollIntoView: true });
    };
    if (tab !== "mdx") {
      setTab("mdx");
      setTimeout(go, 50); // wait for the MDX editor to mount
    } else go();
  };

  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-line px-5 py-2">
        {[
          { label: "B", cls: "font-bold", fn: (s: string) => `**${s || "bold"}**` },
          { label: "I", cls: "italic", fn: (s: string) => `*${s || "italic"}*` },
          { label: "H2", cls: "", fn: (s: string) => `\n## ${s || "Heading"}\n` },
          { label: "Link", cls: "", fn: (s: string) => `[${s || "text"}](https://)` },
          { label: "List", cls: "", fn: (s: string) => `\n- ${s || "item"}\n` },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={tab !== "mdx"}
            onClick={() => replaceSelection(b.fn)}
            className={cn("cursor-pointer rounded-md border border-line-strong px-2.5 py-0.5 disabled:opacity-40", b.cls)}
          >
            {b.label}
          </button>
        ))}
        <span className="mx-2 h-[22px] w-px bg-line-strong" />
        <InsertMenu onInsert={insertComponent} />
        <div className="ml-auto flex gap-1 text-sm">
          {(["split", "editor", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("cursor-pointer rounded-md px-2 py-0.5 capitalize", mode === m ? "bg-highlight text-graphite" : "text-bark")}
            >
              {m === "editor" ? "Editor only" : m === "preview" ? "Preview only" : "Split"}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1",
          // Design 3a: Markdown · live preview · settings (290px), the settings column always present.
          mode === "split" && "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_290px]",
          mode === "editor" && "grid-cols-[minmax(0,1fr)_290px]",
          mode === "preview" && "grid-cols-1",
        )}
      >
        {mode !== "preview" && (
          <div className="flex min-h-0 flex-col border-r border-line bg-card">
            <div className="flex border-b border-line bg-frame font-mono text-[11px] font-semibold text-bark">
              {(["mdx", "json"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("cursor-pointer px-4 py-1.5", tab === t && "bg-card text-graphite")}>
                  {t === "mdx" ? "GUIDE (MARKDOWN)" : "PINS (JSON)"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SourceEditor
                key={tab}
                language={tab === "mdx" ? "mdx" : "json"}
                value={tab === "mdx" ? mdx : waypoints}
                onChange={tab === "mdx" ? onMdx : onWaypoints}
                onReady={onReady}
                onCursor={handleCursor}
              />
            </div>
          </div>
        )}
        {mode !== "editor" && (
          <div className={cn("min-h-0 overflow-y-auto", mode === "split" && "border-r border-line")}>
            <div className="sticky top-0 z-10 border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">LIVE PREVIEW</div>
            <Preview slug={slug} mdx={mdx} waypoints={waypoints} track={track} selectedStart={selected?.start} onSelectComponent={selectFromPreview} />
          </div>
        )}
        {mode !== "preview" && (
          <ComponentSettings component={selected} waypoints={parsedWaypoints} onChange={updateSelectedProps} onDuplicate={duplicateSelected} onRemove={removeSelected} />
        )}
      </div>
    </>
  );
}
