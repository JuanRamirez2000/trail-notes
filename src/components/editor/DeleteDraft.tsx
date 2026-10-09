"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  slug: string;
  title: string;
  /** A published guide can't be deleted: the section says how to get there instead. */
  published: boolean;
  /** False while there's text that isn't saved yet: the server only deletes the version it last saved. */
  saved: boolean;
  /** The version last saved, read when the button is pressed. */
  version: () => string;
};

/**
 * The end of the Details view: delete the hike, after a second click. Only a draft can be deleted
 * (the server refuses a published guide, or one that changed elsewhere), so for a published guide
 * this says to unpublish it first. Its history and photos go too, so there's no undo.
 */
export function DeleteDraft({ slug, title, published, saved, version }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setProblem(null);
    const res = await fetch(`/api/editor/${slug}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseVersion: version() }),
    }).catch(() => null);
    if (res?.ok) {
      // The hike list is rendered per request, so it's read again without this hike.
      router.push("/editor");
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { problems?: string[]; conflict?: boolean } | undefined;
    setProblem(
      !res
        ? "Couldn't reach the server. Nothing was deleted."
        : data?.conflict
          ? "This guide changed elsewhere since you opened it, so it wasn't deleted. Reload and try again."
          : (data?.problems?.[0] ?? (res.status === 404 ? "You're no longer signed in, or this hike is already gone." : `HTTP ${res.status}`)),
    );
    setBusy(false);
    setConfirming(false);
  }

  return (
    <section aria-labelledby="delete-draft" className="mx-auto mb-8 flex w-full max-w-[720px] flex-col gap-2 px-6">
      <h2 id="delete-draft" className="border-t border-line pt-5 font-display text-lg font-bold text-forest">
        Delete this hike
      </h2>
      <p className="text-[15px] text-bark">
        {published
          ? "This guide is published. To delete it, unpublish it first (Unpublish, at the top of the editor), which takes its page down. Then come back here."
          : "Removes the guide, its pins, its route, its photos and its saved history. This can\u2019t be undone. It isn\u2019t published, so no page goes away."}
      </p>
      {!confirming ? (
        <button
          type="button"
          disabled={!saved || published}
          onClick={() => setConfirming(true)}
          className="cursor-pointer self-start rounded-lg border border-pin-bailout px-3.5 py-1 text-pin-bailout disabled:cursor-default disabled:opacity-40"
        >
          Delete draft…
        </button>
      ) : (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-pin-bailout bg-card px-3 py-2">
          <span className="text-graphite">
            Delete <strong>{title}</strong> for good?
          </span>
          <button type="button" disabled={busy} onClick={remove} className="cursor-pointer rounded-lg bg-pin-bailout px-3.5 py-1 text-paper disabled:opacity-60">
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="cursor-pointer rounded-lg border border-line-strong px-3.5 py-1 text-bark">
            Cancel
          </button>
        </div>
      )}
      {!saved && !published && <span className="text-[13px] text-bark">Waiting for your last change to be saved.</span>}
      {problem && (
        <span role="alert" className="text-[13px] text-pin-bailout">
          {problem}
        </span>
      )}
    </section>
  );
}
