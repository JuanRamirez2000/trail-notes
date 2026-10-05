import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getHikeSummaries } from "@/lib/content";

export const metadata: Metadata = { title: "Off the map" };

/** Branded 404: the dashed "pencil trail" runs off the sketch map to a lost pin. */
export default async function NotFound() {
  // A 404 must never fail itself: if the store can't be reached, show the page without suggestions.
  const hikes = (await getHikeSummaries().catch(() => [])).slice(0, 3);
  return (
    <>
      <SiteHeader />
      <main className="bg-contour relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <polyline
            points="4,92 18,78 26,80 38,62 50,58 58,44"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth={3}
            strokeDasharray="7 4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative max-w-md rounded-[10px] border border-line bg-card px-6 py-7 text-center shadow-sketch">
          <span
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border-2 border-white bg-ochre font-mono text-2xl font-semibold text-graphite shadow-[var(--shadow-pin-halo)]"
            aria-hidden
          >
            ?
          </span>
          <p className="font-mono text-xs font-semibold tracking-[.1em] text-bark uppercase">404 · Off the map</p>
          <h1 className="mt-1 font-display text-[32px] leading-[38px] font-bold text-forest">You&apos;ve wandered off the trail</h1>
          <p className="mt-2 text-body text-graphite">
            This page isn&apos;t on any of our maps. It may have moved, or the link has a typo.
          </p>
          <Link href="/" className="mt-5 inline-block rounded-lg bg-forest px-5 py-2.5 text-lg text-paper hover:text-paper">
            ← Back to all hikes
          </Link>

          {hikes.length > 0 && (
            <div className="mt-6 border-t border-dashed border-line-strong pt-4 text-left">
              <p className="text-caption font-semibold tracking-[.06em] text-bark uppercase">Or pick up a trail</p>
              <ul className="mt-2 space-y-1">
                {hikes.map((h) => (
                  <li key={h.slug}>
                    <Link href={`/hikes/${h.slug}`} className="underline">
                      {h.title}
                    </Link>{" "}
                    <span className="text-sm text-bark">· {h.region}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
