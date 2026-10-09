"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/lib/cn";
import { kebab } from "@/lib/ingest";
import { photoUrl } from "@/lib/storage";
import type { PhotoPinsResult, UploadedPhoto } from "./photo-pins";
import { putBlob, requestUploads } from "./photo-upload";
import { PhotoError, processPhoto, type ProcessedPhoto } from "./process-photo";

/** The server takes this many photos per request. */
const BATCH = 30;
export const TRAY_PHOTO = "application/x-trailnotes-photo";

type Item = {
  id: number;
  file: File;
  state: "waiting" | "processing" | "uploading" | "pinned" | "unplaced" | "skipped" | "failed";
  /** Upload progress, 0 to 1. */
  progress?: number;
  note?: string;
};

const STATE_TEXT: Record<Item["state"], string> = {
  waiting: "Waiting",
  processing: "Processing…",
  uploading: "Uploading",
  pinned: "Pinned",
  unplaced: "No GPS: unplaced",
  skipped: "Already added",
  failed: "Failed",
};

export type PhotoPanelHandle = { add: (files: File[]) => void };

type Props = {
  /** For files dropped elsewhere on the Pins view. */
  ref?: Ref<PhotoPanelHandle>;
  slug: string;
  /** Kebab-case names of the photos this hike already has, so the same file isn't added twice. */
  known: Set<string>;
  /** Called once per batch with what was uploaded; says which photos became pins. */
  onUploaded: (photos: UploadedPhoto[]) => PhotoPinsResult;
  /** Stored photos that aren't on a pin or the cover. */
  tray: string[];
  /** The tray photo waiting for a click on the map. */
  placing: string | null;
  onPlacing: (key: string | null) => void;
  /** Resolves with a problem to show, or null once the photo is deleted. */
  onDelete: (key: string) => Promise<string | null>;
  /** Why the stored photos couldn't be listed, if they couldn't. */
  problem: string | null;
  canPlace: boolean;
};

/**
 * Photos in the Pins view: add them (the button, or drop files anywhere on the view), watch each
 * one go from processing to pinned, and deal with the ones that are stored but on no pin.
 */
export function PhotoPanel({ ref, slug, known, onUploaded, tray, placing, onPlacing, onDelete, problem, canPlace }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [trayProblem, setTrayProblem] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  // One batch at a time: a second drop waits for the first, so the server numbers them in order.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const set = (id: number, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const fail = (id: number, err: unknown) => set(id, { state: "failed", note: err instanceof Error ? err.message : "Something went wrong." });

  async function run(batch: Item[]) {
    const ready: { item: Item; photo: ProcessedPhoto }[] = [];
    for (const item of batch) {
      set(item.id, { state: "processing", note: undefined });
      try {
        ready.push({ item, photo: await processPhoto(item.file) });
      } catch (err) {
        // Anything that isn't our own message is a bug or a browser quirk; don't show its text as advice.
        fail(item.id, err instanceof PhotoError ? err : new Error("This photo couldn't be processed."));
      }
    }

    const uploaded: (UploadedPhoto & { id: number })[] = [];
    for (let i = 0; i < ready.length; i += BATCH) {
      const chunk = ready.slice(i, i + BATCH);
      let grants;
      try {
        grants = await requestUploads(slug, chunk.map(({ item, photo }) => ({ name: item.file.name, fullBytes: photo.full.size, thumbBytes: photo.thumb.size })));
      } catch (err) {
        chunk.forEach(({ item }) => fail(item.id, err));
        continue;
      }
      for (const [j, { item, photo }] of chunk.entries()) {
        set(item.id, { state: "uploading", progress: 0 });
        try {
          // The full image is nearly all of the bytes, so it is the progress.
          await putBlob(grants[j].full, photo.full, (progress) => set(item.id, { progress }));
          await putBlob(grants[j].thumb, photo.thumb, () => {});
          uploaded.push({ id: item.id, key: grants[j].key, meta: photo.meta, width: photo.width, height: photo.height });
        } catch (err) {
          fail(item.id, err);
        }
      }
    }

    if (!uploaded.length) return;
    const result = onUploaded(uploaded);
    for (const u of uploaded) set(u.id, result.pinned.has(u.key) ? { state: "pinned", note: undefined } : { state: "unplaced", note: undefined });
    const far = result.offTrack.length;
    if (far) for (const u of uploaded) if (result.offTrack.some((o) => o.id === result.pinned.get(u.key))) set(u.id, { note: "Far from the recorded trail: left at its GPS position." });
  }

  function add(files: File[]) {
    const fresh: Item[] = [];
    const seen = new Set(known);
    const added = files.map((file): Item => {
      const name = kebab(file.name);
      const item: Item = { id: nextId.current++, file, state: seen.has(name) ? "skipped" : "waiting" };
      if (item.state === "waiting") fresh.push(item);
      seen.add(name);
      return item;
    });
    setItems((list) => [...list, ...added]);
    if (fresh.length) queue.current = queue.current.then(() => run(fresh));
  }

  useImperativeHandle(ref, () => ({ add }));

  const busy = items.some((it) => ["waiting", "processing", "uploading"].includes(it.state));
  const finished = items.filter((it) => ["pinned", "unplaced", "skipped"].includes(it.state)).length;

  return (
    <section aria-label="Photos" className="flex-none border-b border-line bg-card" data-photo-drop>
      <div className="flex items-center gap-2 border-b border-line bg-frame px-4 py-1.5">
        <span className="font-mono text-[11px] font-semibold text-bark">PHOTOS</span>
        <button type="button" onClick={() => picker.current?.click()} className="ml-auto cursor-pointer rounded-md border border-forest bg-highlight px-2.5 text-[15px] text-graphite">
          ＋ Add photos
        </button>
        <input
          ref={picker}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          aria-label="Add photos"
          tabIndex={-1}
          onChange={(e) => {
            add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {items.length === 0 && tray.length === 0 && !problem && (
        <p className="px-4 py-2 text-[13px] text-bark">Drop photos here, or use Add photos. Each becomes a pin where it was taken; only the resized image is uploaded, without its location or time.</p>
      )}
      {problem && <p className="px-4 py-2 text-[13px] text-pin-bailout">{problem}</p>}

      {items.length > 0 && (
        <>
          <ul className="max-h-40 overflow-y-auto" aria-label="Uploads" aria-live="polite">
            {items.map((it) => (
              <li key={it.id} className="border-b border-line px-4 py-1.5 text-[15px] last:border-b-0" data-upload={it.state}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
                  <span className={cn("flex-none text-[13px]", it.state === "failed" ? "text-pin-bailout" : it.state === "pinned" ? "text-forest" : "text-bark")}>
                    {STATE_TEXT[it.state]}
                    {it.state === "uploading" && ` ${Math.round((it.progress ?? 0) * 100)}%`}
                  </span>
                  {it.state === "failed" && (
                    <button type="button" className="flex-none cursor-pointer rounded border border-line-strong px-2 text-[13px]" onClick={() => (queue.current = queue.current.then(() => run([it])))}>
                      Retry
                    </button>
                  )}
                </div>
                {it.state === "uploading" && <progress className="block h-1 w-full" max={1} value={it.progress ?? 0} aria-label={`Uploading ${it.file.name}`} />}
                {it.note && <p className={cn("text-[13px]", it.state === "failed" ? "text-pin-bailout" : "text-bark")}>{it.note}</p>}
              </li>
            ))}
          </ul>
          {!busy && (
            <div className="flex items-center border-t border-line px-4 py-1 text-[13px] text-bark">
              <span>
                {finished} of {items.length} done
              </span>
              <button type="button" className="ml-auto cursor-pointer underline" onClick={() => setItems([])}>
                Clear the list
              </button>
            </div>
          )}
        </>
      )}

      {tray.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <div className="text-[13px] text-bark">
            Unplaced · {tray.length}. {canPlace ? "Drag one onto the map, or choose Place and click the map." : "Pick one in a pin's Photo field."}
          </div>
          <ul className="mt-1.5 flex gap-2 overflow-x-auto pb-1" aria-label="Unplaced photos">
            {tray.map((key) => {
              const name = key.split("/")[1];
              return (
                <li key={key} className={cn("w-[92px] flex-none rounded-md border p-1", placing === key ? "border-forest bg-highlight" : "border-line")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a 480 px thumbnail, already the size it's shown at */}
                  <img
                    src={photoUrl(key, "thumb")}
                    alt={name}
                    draggable={canPlace}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(TRAY_PHOTO, key);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn("bg-stripes h-[60px] w-full rounded object-cover", canPlace && "cursor-grab")}
                  />
                  <div className="mt-1 truncate text-[11px] text-bark" title={name}>
                    {name}
                  </div>
                  <div className="mt-0.5 flex justify-between text-[13px]">
                    {canPlace && (
                      <button type="button" aria-pressed={placing === key} aria-label={`Place ${name} on the map`} className="cursor-pointer underline" onClick={() => onPlacing(placing === key ? null : key)}>
                        {placing === key ? "Cancel" : "Place"}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      className="cursor-pointer text-pin-bailout underline"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${name}? The photo's files are removed and can't be brought back.`)) return;
                        setTrayProblem(await onDelete(key));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {trayProblem && <p className="text-[13px] text-pin-bailout">{trayProblem}</p>}
        </div>
      )}
    </section>
  );
}
