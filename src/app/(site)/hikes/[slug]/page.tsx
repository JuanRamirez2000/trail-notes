import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXContent } from "@/components/mdx/MDXContent";
import { BeforeYouGo } from "@/components/hike/BeforeYouGo";
import { GuideScrollSync } from "@/components/hike/GuideScrollSync";
import { MinimapBar } from "@/components/mdx/Minimap";
import { GuideSidebar } from "@/components/sidebar/GuideSidebar";
import { Photo } from "@/components/ui/Photo";
import { getHike, getHikes, getWaypoints } from "@/lib/content";
import { DIFFICULTY_LABEL, formatFeet, formatMiles } from "@/lib/format";
import { directionsUrl } from "@/lib/geo";
import { HikeProvider } from "@/lib/hike-store";

export function generateStaticParams() {
  return getHikes().map((h) => ({ slug: h.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/hikes/[slug]">): Promise<Metadata> {
  const hike = getHike((await params).slug);
  return hike ? { title: hike.title, description: hike.summary } : {};
}

export default async function HikePage({ params }: PageProps<"/hikes/[slug]">) {
  const { slug } = await params;
  const hike = getHike(slug);
  if (!hike) notFound();
  const waypoints = getWaypoints(slug);

  const stats = [
    { k: "Distance", v: formatMiles(hike.distanceMi) },
    { k: "Elev. gain", v: formatFeet(hike.elevationGainFt) },
    hike.estTime && { k: "Est. time", v: hike.estTime },
    { k: "Difficulty", v: DIFFICULTY_LABEL[hike.difficulty] },
    hike.bestSeason && { k: "Best season", v: hike.bestSeason },
  ].filter((s): s is { k: string; v: string } => Boolean(s));

  return (
    <HikeProvider slug={slug} waypoints={waypoints}>
      <GuideScrollSync />
      <article>
        {/* Hero */}
        <div className="relative h-[200px] border-b-[1.5px] border-line-strong sm:h-[360px]">
          <Photo photoKey={hike.cover} alt={hike.title} priority sizes="100vw" className="absolute inset-0" />
          <Link
            href="/"
            className="absolute left-3 top-2.5 rounded-full border border-line bg-card px-2.5 text-[15px] text-graphite sm:hidden"
          >
            ← All hikes
          </Link>
          <div className="absolute bottom-6 left-8 hidden max-w-[520px] rounded-lg border border-line bg-card px-5 py-3 sm:block">
            <Link href="/" className="text-sm text-bark">
              ← All hikes · {hike.region}
            </Link>
            <h1 className="font-display text-[38px] leading-[1.1] font-bold">{hike.title}</h1>
            <p className="text-[17px]">{hike.summary}</p>
          </div>
        </div>

        {/* Mobile title + stat grid */}
        <div className="px-4 pt-3.5 sm:hidden">
          <div className="text-sm text-bark">{hike.region}</div>
          <h1 className="font-display text-[30px] leading-[1.1] font-bold">{hike.title}</h1>
          <p className="mt-1">{hike.summary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {stats.slice(0, 4).map((s) => (
              <div key={s.k} className="rounded-lg border border-line-strong px-2.5 py-1.5">
                <dt className="text-xs text-bark uppercase">{s.k}</dt>
                <dd className="text-[19px]">{s.v}</dd>
              </div>
            ))}
          </dl>
          <a
            href={directionsUrl(hike.trailhead)}
            target="_blank"
            rel="noopener"
            className="mt-3 flex min-h-11 items-center justify-center rounded-[10px] bg-forest p-3.5 text-[19px] text-paper hover:text-paper"
          >
            ➤ Get directions to trailhead
          </a>
        </div>

        {/* Desktop stat bar */}
        <div className="hidden items-center border-b border-line bg-paper-deep px-8 py-4 sm:flex">
          <dl className="flex flex-wrap">
            {stats.map((s) => (
              <div key={s.k} className="mr-[26px] border-r border-line-strong pr-[26px] last:border-r-0">
                <dt className="text-caption tracking-[.06em] text-bark uppercase">{s.k}</dt>
                <dd className="text-[22px]">{s.v}</dd>
              </div>
            ))}
          </dl>
          <div className="ml-auto flex flex-col items-end gap-1">
            <a href={directionsUrl(hike.trailhead)} target="_blank" rel="noopener" className="rounded-lg bg-forest px-5 py-2.5 text-lg text-paper hover:text-paper">
              ➤ Get directions to trailhead
            </a>
            <span className="text-caption text-bark">Opens your maps app</span>
          </div>
        </div>

        {/* Direct child of <article> so `sticky` pins it for the whole page on mobile/tablet */}
        <MinimapBar />

        {/* Guide: sections column + sticky navigation rail */}
        <div className="mx-auto grid w-full max-w-[1200px] gap-11 px-4 pb-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 pt-2">
            <BeforeYouGo essentials={hike.essentials} />
            <MDXContent code={hike.body} />
          </div>
          <GuideSidebar />
        </div>
      </article>
    </HikeProvider>
  );
}
