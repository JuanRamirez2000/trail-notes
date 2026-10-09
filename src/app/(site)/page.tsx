import type { Metadata } from "next";
import Link from "next/link";
import { GuidePreview } from "@/components/landing/GuidePreview";
import { DifficultyStamp } from "@/components/ui/DifficultyStamp";
import { getHikePage, getHikeSummaries } from "@/lib/content";
import { formatFeet, formatMiles } from "@/lib/format";
import { HikeProvider } from "@/lib/hike-store";

// Shows the latest guide, so it's cached like the gallery: refreshed on publish, hourly as a safety net.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** What a guide gives you, in three lines. Only things the published guides actually have. */
const FEATURES = [
  { title: "Route notes", text: "Each turn written out, with the landmark to look for." },
  { title: "Pinned map", text: "Every turn and viewpoint has its own pin, on the route as it was recorded." },
  { title: "A photo at every turn", text: "See the junction or the start of the climb before you reach it." },
];

/** The labels pointing at the guide preview, on screens wide enough to have room beside it. */
const CALLOUTS = [
  { label: "Route notes", className: "right-full top-[150px]", tagFirst: true },
  { label: "Pinned map", className: "left-full top-[90px]", tagFirst: false },
  { label: "Recorded route", className: "left-full top-[290px]", tagFirst: false },
];

const pill = "rounded-full px-6 py-3 text-[17px] font-semibold no-underline";
const primary = `${pill} bg-forest text-paper hover:bg-forest-deep hover:text-paper`;

/**
 * The front door (design: Trailnotes Landing in the Claude Design project): a centred headline
 * and two buttons, a live preview of the latest guide, three features, and a closing line.
 */
export default async function HomePage() {
  const [latest] = await getHikeSummaries();
  const page = latest ? await getHikePage(latest.slug) : null;

  return (
    <>
      <section className="flex flex-col items-center gap-[22px] px-4 pt-12 pb-10 text-center sm:px-12 sm:pt-20 sm:pb-[72px]">
        <h1 className="max-w-[860px] font-display text-[40px] leading-[1.05] font-bold text-balance sm:text-[68px] sm:leading-[70px]">Every turn, pin and view in one guide.</h1>
        <p className="max-w-[620px] text-[19px] leading-[1.5] text-pretty text-bark sm:text-[21px] sm:leading-[31px]">Read the route, check the map and look around before you leave the trailhead.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/hikes" className={primary}>
            Browse hikes
          </Link>
          {latest && (
            <Link href={`/hikes/${latest.slug}`} className={`${pill} border-[1.5px] border-forest py-[11px] text-forest hover:bg-highlight hover:text-forest`}>
              See a sample guide
            </Link>
          )}
        </div>
      </section>

      {page && (
        <section aria-label={`A guide: ${page.hike.title}`} className="mx-auto w-full max-w-[1200px] px-4 pb-14 sm:px-12 sm:pb-24 xl:px-[168px]">
          <div className="relative">
            <HikeProvider slug={page.hike.slug} waypoints={page.waypoints} route={page.route} profile={page.profile}>
              <GuidePreview
                title={page.hike.title}
                stats={
                  <>
                    <span>{formatMiles(page.hike.distanceMi)}</span>
                    <span>↑ {formatFeet(page.hike.elevationGainFt)}</span>
                    <DifficultyStamp level={page.hike.difficulty} />
                  </>
                }
              />
            </HikeProvider>
            {CALLOUTS.map((c) => (
              <div key={c.label} aria-hidden className={`absolute hidden items-center xl:flex ${c.className} ${c.tagFirst ? "" : "flex-row-reverse"}`}>
                <span className="rounded-lg border-[1.5px] border-forest bg-card px-2.5 py-1.5 font-mono text-xs font-semibold whitespace-nowrap uppercase shadow-sketch">{c.label}</span>
                <span className="h-0.5 w-8 bg-forest" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="features" aria-label="What's in a guide" className="scroll-mt-4 border-t border-line bg-card">
        <ul className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-10 px-4 py-12 sm:px-12 sm:py-[72px]">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <h2 className="font-display text-2xl font-bold">{f.title}</h2>
              <p className="mt-1.5 text-body leading-[25px] text-pretty text-bark">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line-strong bg-highlight">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-5 px-4 py-11 sm:px-12">
          <p className="font-display text-[28px] leading-tight font-bold">Pick your next hike.</p>
          <Link href="/hikes" className={`${primary} ml-auto px-6 py-[11px] text-base`}>
            Browse hikes
          </Link>
        </div>
      </section>
    </>
  );
}
