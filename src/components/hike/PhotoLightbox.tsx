"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { formatMiles } from "@/lib/format";
import { useHike, useHikeApi } from "@/lib/hike-store";
import { photoUrl } from "@/lib/storage";

/**
 * A guide's photos full-size, one at a time, in a native `<dialog>` (which brings focus trapping
 * and Escape with it), filling the screen. Opened by the photo in a guide section or a photo card
 * (`openPhoto` in the hike store). Stepping through the photos selects each one's pin, so the maps
 * follow along behind, and on closing the guide scrolls to the photo that was left open.
 * One per `<HikeProvider>`. 360° photos have their own viewer and aren't included.
 */
export function PhotoLightbox() {
  const dialog = useRef<HTMLDialogElement>(null);
  const api = useHikeApi();
  const openId = useHike((s) => s.photo);
  const openPhoto = useHike((s) => s.openPhoto);
  const photos = useHike((s) => s.waypoints).filter((w) => w.photo?.kind === "flat");
  const index = photos.findIndex((w) => w.id === openId);
  const wp = photos[index];
  // The photo the dialog was opened on, to tell on closing whether the reader moved.
  const openedOn = useRef<string | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (wp && !el.open) {
      openedOn.current = wp.id;
      el.showModal();
      // A modal dialog doesn't stop the page behind it from scrolling.
      document.body.style.overflow = "hidden";
    } else if (!wp && el.open) el.close();
  }, [wp]);
  useEffect(() => () => void (document.body.style.overflow = ""), []);

  const step = (by: 1 | -1) => {
    const next = photos[index + by];
    if (next) openPhoto(next.id);
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Photo"
      className="m-auto max-h-none max-w-none bg-graphite p-0 text-paper backdrop:bg-graphite"
      onClose={() => {
        document.body.style.overflow = "";
        const { photo, select } = api.getState();
        openPhoto(null);
        if (photo && photo !== openedOn.current) select(photo, { reveal: true });
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
    >
      {wp?.photo && (
        <figure className="flex h-dvh w-screen flex-col px-3 py-3 sm:px-6">
          <div className="flex flex-none items-center gap-3 pb-2">
            <span className="text-[15px]">
              Photo {index + 1} of {photos.length}
            </span>
            <button type="button" onClick={() => dialog.current?.close()} className="ml-auto min-h-11 cursor-pointer rounded-lg border border-paper/50 px-4 text-paper">
              Close ✕
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image key={wp.photo.key} src={photoUrl(wp.photo.key)} alt={wp.photo.alt ?? wp.title} fill sizes="100vw" className="object-contain" />
          </div>
          <figcaption className="flex flex-none items-center gap-3 pt-2">
            <button type="button" onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous photo" className="min-h-11 min-w-11 flex-none cursor-pointer rounded-lg border border-paper/50 text-paper disabled:cursor-default disabled:opacity-30">
              ◀
            </button>
            <span className="min-w-0 flex-1 text-center leading-snug">
              <span className="block font-display text-lg font-bold">{wp.title}</span>
              <span className="line-clamp-2 text-[15px] opacity-85">
                {wp.stepIndex !== null ? `Step ${wp.stepIndex + 1} · ` : ""}
                {formatMiles(wp.mile)}
                {wp.caption ? ` · ${wp.caption}` : ""}
              </span>
            </span>
            <button type="button" onClick={() => step(1)} disabled={index >= photos.length - 1} aria-label="Next photo" className="min-h-11 min-w-11 flex-none cursor-pointer rounded-lg border border-paper/50 text-paper disabled:cursor-default disabled:opacity-30">
              ▶
            </button>
          </figcaption>
        </figure>
      )}
    </dialog>
  );
}
