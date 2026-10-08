"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { joinGuide, readDetails, setDetail, splitGuide, yamlProblems } from "@/lib/frontmatter";
import { routeCoords } from "@/lib/hike";
import { COMPONENT_NAMES } from "@/lib/mdx/manifest";
import { essentialsSchema, type Track } from "@/lib/schemas";
import { AdvancedView } from "./AdvancedView";
import { countComponents, countWords, parseWaypoints } from "./compile";
import { DeleteDraft } from "./DeleteDraft";
import { DetailsForm } from "./DetailsForm";
import { EditorAccount } from "./EditorAccount";
import { PinsView } from "./pins/PinsView";
import type { Cursor } from "./SourceEditor";

// MDXEditor is large and browser-only, so it loads when the Write view is opened.
const WriteView = dynamic(() => import("./write/WriteView"), {
  ssr: false,
  loading: () => <p className="p-6 text-bark">Loading the editor…</p>,
});

type Props = {
  slug: string;
  initialMdx: string;
  initialWaypoints: string;
  /** The store's version of what was loaded; sent back with each save so a stale tab can't overwrite newer work. */
  initialVersion: string;
  track: Track | null;
  editorName: string;
  canSignOut: boolean;
};
type View = "write" | "details" | "pins" | "advanced";
type SaveState = { kind: "idle" | "saving" | "conflict" } | { kind: "saved"; at: Date } | { kind: "error"; problems: string[] };

const AUTOSAVE_MS = 1500;
const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "write", label: "Write", hint: "The guide as a document, with its blocks" },
  { id: "details", label: "Details", hint: "Title, stats, Before you go, sidebar" },
  { id: "pins", label: "Pins", hint: "Pins on the map: move, aim, add, edit" },
  { id: "advanced", label: "Advanced", hint: "Raw Markdown and pins JSON" },
];

/**
 * The editor shell: holds the guide being edited (its MDX and its pins), saves it, and switches
 * between four views of the same document. Write, Details and Pins are how guides are meant to
 * be made; Advanced is the raw source underneath them.
 */
export function Editor({ slug, initialMdx, initialWaypoints, initialVersion, track, editorName, canSignOut }: Props) {
  const [mdx, setMdx] = useState(initialMdx);
  const [waypoints, setWaypoints] = useState(initialWaypoints);
  const [view, setView] = useState<View>("write");
  const [cursor, setCursor] = useState<Cursor>({ line: 1, col: 1, offset: 0 });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const versionRef = useRef(initialVersion);
  const [saved, setSaved] = useState({ mdx: initialMdx, waypoints: initialWaypoints });
  const dirty = mdx !== saved.mdx || waypoints !== saved.waypoints;

  const doc = useMemo(() => splitGuide(mdx), [mdx]);
  const details = useMemo(() => readDetails(doc.yaml), [doc.yaml]);
  const isDraft = details.draft === true;
  const parsed = useMemo(() => parseWaypoints(waypoints, track), [waypoints, track]);
  const pins = useMemo(() => (parsed.ok ? parsed.waypoints : []), [parsed]);
  const route = useMemo(() => routeCoords(pins, track), [pins, track]);
  const essentials = useMemo(() => essentialsSchema.safeParse(details.essentials).data, [details.essentials]);

  // What a save sends is read from here, so the save function itself never changes and a save
  // that was asked for while another is on its way can pick up the newest text when its turn comes.
  const latest = useRef({ mdx, waypoints });
  useEffect(() => {
    latest.current = { mdx, waypoints };
  }, [mdx, waypoints]);
  const saving = useRef(false);
  const saveAgain = useRef(false);

  // One save at a time. Each save names the version it's based on, and that version only arrives
  // with the previous save's answer: two overlapping saves would both name the old one, and the
  // second would be refused as a conflict with the editor's own first.
  const doSave = useCallback(async () => {
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    saving.current = true;
    // Loops while there is newer text that was asked to be saved during the save just finished.
    for (;;) {
      saveAgain.current = false;
      const snapshot = latest.current;
      setSave({ kind: "saving" });
      let next: SaveState;
      const res = await fetch(`/api/editor/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...snapshot, baseVersion: versionRef.current }),
      }).catch(() => null);
      if (!res) {
        next = { kind: "error", problems: ["Couldn't reach the server. Your text is still here; it will retry when you edit or press Save."] };
      } else {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; problems?: string[]; version?: string; conflict?: boolean };
        if (res.ok && data.ok && data.version) {
          versionRef.current = data.version;
          setSaved(snapshot);
          next = { kind: "saved", at: new Date() };
        } else if (res.status === 409) {
          next = { kind: "conflict" };
        } else if (res.status === 404) {
          next = { kind: "error", problems: ["You're no longer signed in (or this hike was removed). Open the sign-in page in another tab, then press Save."] };
        } else {
          next = { kind: "error", problems: data.problems ?? [`HTTP ${res.status}`] };
        }
      }
      setSave(next);
      // Never again after a conflict: retrying could only fail.
      const changed = latest.current.mdx !== snapshot.mdx || latest.current.waypoints !== snapshot.waypoints;
      if (next.kind === "conflict" || !saveAgain.current || !changed) break;
    }
    saving.current = false;
  }, [slug]);

  // Autosave after a pause in typing. Invalid content is rejected server-side and shown, never written.
  // A conflict stops autosave: retrying would only fail again, and must never overwrite the newer version.
  const conflicted = save.kind === "conflict";
  useEffect(() => {
    if (!dirty || conflicted) return;
    const t = setTimeout(doSave, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [mdx, waypoints, dirty, conflicted, doSave]);

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

  // Leaving with text that isn't saved (still typing, a save on its way, or a save that was
  // refused) asks first; the browser shows its own "Leave site?" dialog.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // The Write view edits the body and the Details form edits the frontmatter; each change is put
  // back together with the other half as it is right now.
  const setBody = useCallback((body: string) => setMdx((prev) => joinGuide({ yaml: splitGuide(prev).yaml, body })), []);
  const setYaml = useCallback((yaml: string) => setMdx((prev) => joinGuide({ yaml, body: splitGuide(prev).body })), []);
  // Publishing is a change like any other (the guide's `draft` flag), saved by the same autosave.
  const setDraft = (draft: boolean) => {
    // A frontmatter with a YAML error can't be rewritten safely; say so instead of doing nothing.
    const problems = yamlProblems(doc.yaml);
    if (problems.length) setSave({ kind: "error", problems: [`Can't ${draft ? "unpublish" : "publish"} yet. The guide's details have a problem (see Details): ${problems[0]}`] });
    else setYaml(setDetail(doc.yaml, ["draft"], draft));
  };

  // Where the selected block in the Write view renders its settings form.
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [deselect, setDeselect] = useState(0);

  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "saved"
        ? `Saved ${save.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : save.kind === "error"
          ? "Not saved: fix the errors below"
          : save.kind === "conflict"
            ? "Not saved: this guide changed elsewhere"
            : dirty
              ? "Unsaved changes"
              : "All changes saved";

  return (
    <div className="flex h-dvh flex-col bg-paper">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-frame px-5 py-2.5">
        <Link href="/editor" className="text-[15px] text-bark">
          ← Hikes
        </Link>
        <span className="min-w-0 truncate text-xl max-sm:basis-full">{typeof details.title === "string" && details.title ? details.title : slug}</span>
        <span className="rounded-full border border-line-strong px-2.5 text-sm text-bark">{isDraft ? "Draft" : "Published"}</span>
        <span className={cn("ml-auto text-sm", save.kind === "error" || save.kind === "conflict" ? "text-pin-bailout" : "text-bark")}>{status}</span>
        <EditorAccount name={editorName} canSignOut={canSignOut} />
        <a href={`/hikes/${slug}`} target="_blank" rel="noopener" className="rounded-lg border border-line bg-card px-3.5 py-1 text-graphite">
          {isDraft ? "View page ↗" : "View live page ↗"}
        </a>
        {isDraft ? (
          <button type="button" onClick={() => setDraft(false)} className="cursor-pointer rounded-lg bg-forest px-3.5 py-1 text-paper">
            Publish
          </button>
        ) : (
          <button type="button" onClick={() => setDraft(true)} className="cursor-pointer rounded-lg border border-line-strong px-3.5 py-1 text-bark">
            Unpublish
          </button>
        )}
        <button type="button" onClick={doSave} className="cursor-pointer rounded-lg border border-line bg-card px-3.5 py-1 text-graphite">
          Save <span className="opacity-60">⌘S</span>
        </button>
      </div>

      {/* View switch */}
      <div role="tablist" aria-label="Editor view" className="flex items-end gap-1 border-b border-line bg-paper-deep px-5 pt-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            title={v.hint}
            onClick={() => setView(v.id)}
            className={cn(
              "-mb-px cursor-pointer rounded-t-lg border border-b-0 px-4 py-1.5",
              view === v.id ? "border-line bg-paper font-semibold text-forest" : "border-transparent text-bark hover:text-graphite",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {save.kind === "conflict" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-pin-bailout bg-card px-5 py-2 text-sm text-pin-bailout">
          <span>
            This guide was changed since you opened it (in another tab, or by someone else), so your changes were <strong>not saved</strong> and nothing was overwritten. Copy anything
            you want to keep, then reload to get the latest version.
          </span>
          <button type="button" onClick={() => window.location.reload()} className="cursor-pointer rounded-lg border border-pin-bailout px-3 py-0.5">
            Reload
          </button>
        </div>
      )}

      {save.kind === "error" && (
        <ul role="alert" className="border-b border-pin-bailout bg-card px-5 py-2 font-mono text-xs text-pin-bailout">
          {save.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {view === "write" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-h-0 overflow-y-auto">
            {parsed.ok ? (
              // Remounted when the pins change (Advanced view), so the blocks see the new pins.
              <WriteView
                key={waypoints}
                body={doc.body}
                onChange={setBody}
                waypoints={pins}
                route={route}
                essentials={essentials}
                panel={panel}
                onSelectionChange={setHasSelection}
                deselect={deselect}
                onOpenAdvanced={() => setView("advanced")}
              />
            ) : (
              <p className="m-6 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-3 text-pin-bailout">
                The pins have a problem, so the guide can&rsquo;t be shown here. Fix it under Advanced → Pins (JSON): {parsed.error}
              </p>
            )}
          </div>
          {/* On a narrow screen the settings sit under the document instead of beside it. */}
          <aside aria-label="Block settings" className={cn("flex min-h-0 flex-col border-t border-line bg-paper-deep lg:border-t-0 lg:border-l", !hasSelection && "max-lg:hidden")}>
            <div className="flex items-center justify-between border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">
              BLOCK SETTINGS
              {hasSelection && (
                <button type="button" onClick={() => setDeselect((n) => n + 1)} className="cursor-pointer rounded-md border border-line-strong bg-card px-2 py-0.5 font-sans text-[13px] font-normal lg:hidden">
                  Done
                </button>
              )}
            </div>
            <div ref={setPanel} className="min-h-0 flex-1 overflow-y-auto empty:hidden max-lg:max-h-[45dvh]" />
            {!hasSelection && <p className="px-4 py-3.5 text-[15px] text-bark">Click a block in the guide (a map, a step, a photo card) to change its settings.</p>}
          </aside>
        </div>
      )}

      {view === "details" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DetailsForm yaml={doc.yaml} waypoints={pins} onChange={setYaml} />
          {isDraft && (
            <DeleteDraft slug={slug} title={typeof details.title === "string" && details.title ? details.title : slug} saved={!dirty && save.kind !== "saving"} version={() => versionRef.current} />
          )}
        </div>
      )}

      {view === "pins" &&
        (parsed.ok ? (
          <PinsView
            waypoints={waypoints}
            pins={pins}
            mdx={mdx}
            track={track}
            route={route}
            onWaypoints={setWaypoints}
            onBoth={(json, nextMdx) => {
              setWaypoints(json);
              setMdx(nextMdx);
            }}
          />
        ) : (
          <p className="m-6 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-3 text-pin-bailout">The pins have a problem that has to be fixed under Advanced → Pins (JSON) first: {parsed.error}</p>
        ))}

      {view === "advanced" && (
        <AdvancedView slug={slug} mdx={mdx} waypoints={waypoints} onMdx={setMdx} onWaypoints={setWaypoints} track={track} parsedWaypoints={pins} onCursor={setCursor} />
      )}

      {/* Status bar */}
      <div className="flex gap-[18px] border-t border-line bg-frame px-5 py-1.5 text-caption text-bark">
        <span>{countWords(mdx)} words</span>
        <span>{countComponents(mdx, COMPONENT_NAMES)} blocks</span>
        {view === "advanced" && (
          <span>
            Line {cursor.line}, col {cursor.col}
          </span>
        )}
      </div>
    </div>
  );
}
