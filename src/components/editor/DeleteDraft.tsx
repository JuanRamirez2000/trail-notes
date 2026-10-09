"use client";

import { useState } from "react";
import { DELETE_DELAY_HOURS } from "@/lib/store/types";

type Props = {
  slug: string;
  title: string;
  /** Deleting a published guide takes its page down straight away; the text says so. */
  published: boolean;
  /** False while there's text that isn't saved yet: the server only deletes the version it last saved. */
  saved: boolean;
  /** The version last saved, read when the button is pressed. */
  version: () => string;
  /** The hike is now scheduled for deletion; `deleteAfter` is when it's removed for good. */
  onDeleted: (deleteAfter: string) => void;
};

/**
 * The end of the Details view: delete the hike, after a second click. Deleting isn't immediate:
 * the hike comes off the site now and is removed for good 72 hours later, and in between the
 * editor offers to restore it. The server refuses a hike that changed elsewhere.
 */
export function DeleteDraft({ slug, title, published, saved, version, onDeleted }: Props) {
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
    const data = (await res?.json().catch(() => ({}))) as { deleteAfter?: string; problems?: string[]; conflict?: boolean } | undefined;
    if (res?.ok && data?.deleteAfter) {
      onDeleted(data.deleteAfter);
      return;
    }
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
    <section aria-labelledby="delete-hike" className="mx-auto mb-8 flex w-full max-w-[720px] flex-col gap-2 px-6">
      <h2 id="delete-hike" className="border-t border-line pt-5 font-display text-lg font-bold text-forest">
        Delete this hike
      </h2>
      <p className="text-[15px] text-bark">
        <strong className="text-graphite">Deleting takes {DELETE_DELAY_HOURS} hours.</strong> {published ? "The public page comes down straight away. " : ""}For {DELETE_DELAY_HOURS} hours the hike stays here, marked as deleted, and you can
        restore it. After that the guide, its pins, its route, its photos and its saved history are removed for good.
      </p>
      {!confirming ? (
        <button
          type="button"
          disabled={!saved}
          onClick={() => setConfirming(true)}
          className="cursor-pointer self-start rounded-lg border border-pin-bailout px-3.5 py-1 text-pin-bailout disabled:cursor-default disabled:opacity-40"
        >
          Delete hike…
        </button>
      ) : (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-pin-bailout bg-card px-3 py-2">
          <span className="text-graphite">
            Delete <strong>{title}</strong>? {published ? "Its page comes down now. " : ""}You have {DELETE_DELAY_HOURS} hours to restore it.
          </span>
          <button type="button" disabled={busy} onClick={remove} className="cursor-pointer rounded-lg bg-pin-bailout px-3.5 py-1 text-paper disabled:opacity-60">
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="cursor-pointer rounded-lg border border-line-strong px-3.5 py-1 text-bark">
            Cancel
          </button>
        </div>
      )}
      {!saved && <span className="text-[13px] text-bark">Waiting for your last change to be saved.</span>}
      {problem && (
        <span role="alert" className="text-[13px] text-pin-bailout">
          {problem}
        </span>
      )}
    </section>
  );
}
