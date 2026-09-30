"use client";

import type { EditorView } from "@codemirror/view";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { registry, type RegisteredComponent } from "@/components/mdx/registry";
import { cn } from "@/lib/cn";
import { countComponents, countWords, parseWaypoints } from "./compile";
import { InsertMenu } from "./InsertMenu";
import { Preview } from "./Preview";
import type { Cursor } from "./SourceEditor";

const SourceEditor = dynamic(() => import("./SourceEditor"), {
  ssr: false,
  loading: () => <div className="p-4 font-mono text-sm text-bark">Loading editor…</div>,
});

type Props = { slug: string; initialMdx: string; initialWaypoints: string };
type Tab = "mdx" | "json";
type Mode = "split" | "editor" | "preview";
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: Date; problems?: string[] };

const AUTOSAVE_MS = 1500;

export function Editor({ slug, initialMdx, initialWaypoints }: Props) {
  const [mdx, setMdx] = useState(initialMdx);
  const [waypoints, setWaypoints] = useState(initialWaypoints);
  const [tab, setTab] = useState<Tab>("mdx");
  const [mode, setMode] = useState<Mode>("split");
  const [cursor, setCursor] = useState<Cursor>({ line: 1, col: 1 });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const viewRef = useRef<EditorView | null>(null);
  const [saved, setSaved] = useState({ mdx: initialMdx, waypoints: initialWaypoints });
  const dirty = mdx !== saved.mdx || waypoints !== saved.waypoints;
  const isDraft = /^draft:\s*true\s*$/m.test(mdx);

  const doSave = useCallback(async () => {
    const snapshot = { mdx, waypoints };
    setSave({ kind: "saving" });
    const res = await fetch(`/api/editor/${slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; problems?: string[] };
    if (res.ok && data.ok) {
      setSaved(snapshot);
      setSave({ kind: "saved", at: new Date() });
    } else {
      setSave({ kind: "error", problems: data.problems ?? [`HTTP ${res.status}`] });
    }
  }, [mdx, waypoints, slug]);

  // Autosave after a pause in typing. Invalid content is rejected server-side and shown, never written.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(doSave, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, doSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

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
    const wps = parseWaypoints(waypoints);
    const list = wps.ok ? wps.waypoints : [];
    const pick =
      name === "PanoViewer"
        ? list.find((w) => w.photo?.kind === "pano")
        : list.find((w) => w.photo?.kind === "flat" && w.type !== "start") ?? list[0];
    const snippet = registry[name].snippet.replace("{{waypoint}}", pick?.id ?? "waypoint-id");
    if (tab !== "mdx") setTab("mdx");
    // Wait a tick if we just switched tabs so the MDX editor is mounted.
    setTimeout(() => replaceSelection(() => `\n${snippet}\n`), tab === "mdx" ? 0 : 50);
  };

  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "saved"
        ? `Saved ${save.at!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : save.kind === "error"
          ? "Not saved: fix the errors below"
          : dirty
            ? "Unsaved changes"
            : "All changes saved";

  const onReady = useCallback((v: EditorView) => (viewRef.current = v), []);

  return (
    <div className="flex h-dvh flex-col bg-paper">
      {/* Top bar */}
      <div className="flex items-center gap-3.5 border-b border-line bg-frame px-5 py-2.5">
        <Link href="/editor" className="text-[15px] text-bark">← Hikes</Link>
        <span className="text-xl">{/^title:\s*(.+)$/m.exec(mdx)?.[1] ?? slug}</span>
        <span className="rounded-full border border-line-strong px-2.5 text-sm text-bark">{isDraft ? "Draft" : "Published"}</span>
        <span className={cn("ml-auto text-sm", save.kind === "error" ? "text-pin-bailout" : "text-bark")}>{status}</span>
        <a href={`/hikes/${slug}`} target="_blank" rel="noopener" className="rounded-lg border border-line bg-card px-3.5 py-1 text-graphite">
          Preview page ↗
        </a>
        <button type="button" onClick={doSave} className="cursor-pointer rounded-lg bg-forest px-3.5 py-1 text-paper">
          Save <span className="opacity-60">⌘S</span>
        </button>
      </div>

      {/* Toolbar */}
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

      {save.kind === "error" && save.problems && (
        <ul className="border-b border-pin-bailout bg-card px-5 py-2 font-mono text-xs text-pin-bailout">
          {save.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {/* Panes */}
      <div className={cn("grid min-h-0 flex-1", mode === "split" ? "grid-cols-2" : "grid-cols-1")}>
        {mode !== "preview" && (
          <div className="flex min-h-0 flex-col border-r border-line bg-card">
            <div className="flex border-b border-line bg-frame font-mono text-[11px] font-semibold text-bark">
              {(["mdx", "json"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("cursor-pointer px-4 py-1.5", tab === t && "bg-card text-graphite")}
                >
                  {t === "mdx" ? "INDEX.MDX" : "WAYPOINTS.JSON"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SourceEditor
                key={tab}
                language={tab === "mdx" ? "mdx" : "json"}
                value={tab === "mdx" ? mdx : waypoints}
                onChange={tab === "mdx" ? setMdx : setWaypoints}
                onReady={onReady}
                onCursor={setCursor}
              />
            </div>
          </div>
        )}
        {mode !== "editor" && (
          <div className="min-h-0 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">LIVE PREVIEW</div>
            <Preview slug={slug} mdx={mdx} waypoints={waypoints} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex gap-[18px] border-t border-line bg-frame px-5 py-1.5 text-caption text-bark">
        <span>{countWords(mdx)} words</span>
        <span>{countComponents(mdx, Object.keys(registry))} components</span>
        <span>
          Line {cursor.line}, col {cursor.col}
        </span>
      </div>
    </div>
  );
}
