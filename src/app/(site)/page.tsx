import type { Metadata } from "next";
import Link from "next/link";
import { HikeCard } from "@/components/gallery/HikeCard";
import { DifficultyStamp } from "@/components/ui/DifficultyStamp";
import { Photo } from "@/components/ui/Photo";
import { Pin } from "@/components/ui/Pin";
import { getHikeSummaries } from "@/lib/content";
import { formatFeet, formatMiles } from "@/lib/format";
import type { WaypointType } from "@/lib/schemas";

// Lists the latest guides, so it's cached like the gallery: refreshed on publish, hourly as a safety net.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

const eyebrow = "font-mono text-xs font-semibold tracking-[.1em] text-bark uppercase";

/** What a guide gives you, each with the pin it shows up as on the map. */
const FEATURES: { pin: WaypointType; title: string; text: string }[] = [
  {
    pin: "turn",
    title: "A photo where the trail changes",
    text: "Junctions, the start of the steep part, the spot where the path is easy to lose: each has a photo, looking the way you'll be walking.",
  },
  {
    pin: "start",
    title: "The route as it was walked",
    text: "The line on the map, the mileage of every pin and the elevation profile come from a GPS recording of the hike, not from a drawing.",
  },
  {
    pin: "water",
    title: "What to know before you go",
    text: "Parking, water and hazards up front, and the water sources, bail-outs and ranger stations marked along the way.",
  },
];

/** The front door: what Trailnotes is, the latest guide, and the way into the gallery. */
export default async function HomePage() {
  const hikes = await getHikeSummaries();
  const [latest, ...rest] = hikes;

  return (
    <>
      <section className="bg-contour border-b border-line">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-4 py-10 sm:px-7 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
          <div className="max-w-[640px] rounded-[10px] border border-line bg-card px-5 py-6 shadow-sketch sm:px-8 sm:py-8">
            <p className={eyebrow}>Photo-by-photo hiking guides</p>
            <h1 className="mt-2 font-display text-[34px] leading-[1.08] font-bold text-forest sm:text-[46px]">Know every turn before you get there.</h1>
            <p className="mt-4 text-body">
              Each guide follows one hike from the trailhead to the top, with a photo at every point where the trail changes, pinned on the map where it was taken.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/hikes" className="rounded-lg bg-forest px-5 py-2.5 text-lg text-paper no-underline hover:text-paper">
                Browse the hikes
              </Link>
              {latest && (
                <Link href={`/hikes/${latest.slug}`} className="text-lg underline underline-offset-4">
                  Read {latest.title} →
                </Link>
              )}
            </div>
          </div>

          {latest && (
            <Link href={`/hikes/${latest.slug}`} className="group block overflow-hidden rounded-[10px] border border-line bg-card text-graphite no-underline shadow-sketch hover:text-graphite">
              <div className="relative h-[220px] border-b-[1.5px] border-line-strong sm:h-[260px]">
                {/* Decorative: the title is in the caption below. */}
                <Photo photoKey={latest.cover} alt="" priority sizes="(min-width: 1024px) 440px, 100vw" className="absolute inset-0" />
                <span className="absolute left-3 top-3 rounded-full border border-line bg-card px-2.5 font-mono text-[11px] leading-6 font-semibold tracking-[.08em] text-bark uppercase">
                  Latest guide
                </span>
              </div>
              <div className="px-4 py-3.5">
                <div className="font-display text-2xl font-bold group-hover:text-forest">{latest.title}</div>
                <div className="text-sm text-bark">{latest.region}</div>
                <div className="mt-2 flex items-center gap-3 text-[15px]">
                  <span>{formatMiles(latest.distanceMi)}</span>
                  <span>↑ {formatFeet(latest.elevationGainFt)}</span>
                  <DifficultyStamp level={latest.difficulty} className="ml-auto" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="in-a-guide" className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-7 sm:py-14">
        <p className={eyebrow}>How it works</p>
        <h2 id="in-a-guide" className="mt-1 font-display text-h2 font-bold text-forest">
          What&rsquo;s in a guide
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-[10px] border border-line bg-card px-5 py-5">
              <Pin type={f.pin} size={26} />
              <h3 className="mt-3.5 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-1.5 text-bark">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="more-guides" className="border-t border-line bg-paper-deep">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-7 sm:py-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="more-guides" className="font-display text-h2 font-bold text-forest">
                More guides
              </h2>
              <Link href="/hikes" className="text-lg underline underline-offset-4">
                All {hikes.length} on the map →
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-[18px] lg:grid-cols-3">
              {rest.slice(0, 3).map((h) => (
                <HikeCard key={h.slug} hike={h} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
