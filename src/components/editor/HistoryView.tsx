"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { Track } from "@/lib/schemas";
import type { HikeContent, Revision } from "@/lib/store/types";
import { Preview } from "./Preview";

type Props = {
  slug: string;
  track: Track | null;
  /** What the editor holds now, to mark the version it matches. */
  current: HikeContent;
  /** True when there's text the server hasn't saved yet; restoring would replace it. */
  unsaved: boolean;
  /** Loads a version into the editor. It's then saved like any edit, as a new version. */
  onRestore: (content: HikeContent) => void;
};

type Listing = { kind: "loading" } | { kind: "error" } | { kind: "ready"; revisions: Revision[]; kept: boolean };

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Every saved version of the guide, newest first, with a preview of the one picked. Restoring
 * doesn't rewrite history: it loads that version into the editor, and autosave saves it as the
 * newest version (so a restore can itself be undone from here, and a stale tab still conflicts).
 */
export function HistoryView({ slug, track, current, unsaved, onRestore }: Props) {
  const [listing, setListing] = useState<Listing>({ kind: "loading" });
  const [picked, setPicked] = useState<{ version: string; content: HikeContent | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/editor/${slug}/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { revisions: Revision[]; kept: boolean }) => !cancelled && setListing({ kind: "ready", ...data }))
      .catch(() => !cancelled && setListing({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const pick = async (version: string) => {
    setPicked({ version, content: null });
    const res = await fetch(`/api/editor/${slug}/history/${version}`, { cache: "no-store" }).catch(() => null);
    const content = res?.ok ? ((await res.json()) as HikeContent) : null;
    setPicked((p) => (p?.version === version ? { version, content } : p));
  };

  if (listing.kind === "loading") return <p className="p-6 text-bark">Loading the history…</p>;
  if (listing.kind === "error") return <p className="m-6 text-pin-bailout">Couldn&rsquo;t load the history. You may no longer be signed in; reload to check.</p>;
  if (!listing.kept)
    return (
      <p className="m-6 max-w-[640px] text-bark">
        Guides kept as files (<code>content/hikes</code>) have no history here: git keeps theirs. On the live site, every save is kept and listed in this view.
      </p>
    );

  const isCurrent = (c: HikeContent | null) => !!c && c.mdx === current.mdx && c.waypoints === current.waypoints;
  const restore = (c: HikeContent) => {
    if (unsaved && !window.confirm("Your latest changes haven't been saved yet. Replace them with this version?")) return;
    onRestore(c);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav aria-label="Saved versions" className="min-h-0 overflow-y-auto border-b border-line bg-paper-deep max-lg:max-h-[35dvh] lg:border-r lg:border-b-0">
        <p className="border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">SAVED VERSIONS ({listing.revisions.length})</p>
        <ul>
          {listing.revisions.map((r) => (
            <li key={r.version}>
              <button
                type="button"
                aria-current={picked?.version === r.version ? "true" : undefined}
                onClick={() => pick(r.version)}
                className={cn("flex w-full cursor-pointer flex-col items-start border-b border-line px-4 py-2 text-left hover:bg-card", picked?.version === r.version && "bg-card")}
              >
                <span className="text-graphite">
                  {when(r.savedAt)} <span className="text-[13px] text-bark">· v{r.version}</span>
                </span>
                <span className="text-[13px] text-bark">
                  {r.savedBy ?? "unknown"} · {r.status === "published" ? "Published" : "Draft"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label="Version preview" className="flex min-h-0 flex-col">
        {!picked ? (
          <p className="p-6 text-bark">Pick a version to see it. Restoring one loads it into the editor, where it&rsquo;s saved as the newest version; nothing in this list is ever removed.</p>
        ) : !picked.content ? (
          <p className="p-6 text-bark">Loading version {picked.version}…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-frame px-5 py-2">
              <span className="text-graphite">Version {picked.version}</span>
              {isCurrent(picked.content) ? (
                <span className="text-sm text-bark">This is what the editor holds now.</span>
              ) : (
                <button type="button" onClick={() => restore(picked.content!)} className="ml-auto cursor-pointer rounded-lg bg-forest px-3.5 py-1 text-paper">
                  Restore this version
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Preview slug={slug} mdx={picked.content.mdx} waypoints={picked.content.waypoints} track={track} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
