import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXContent } from "@/components/mdx/MDXContent";
import { GuideScrollSync } from "@/components/hike/GuideScrollSync";
import { MinimapBar } from "@/components/mdx/Minimap";
import { GuideSidebar } from "@/components/sidebar/GuideSidebar";
import { Photo } from "@/components/ui/Photo";
import { getHikePage, getHikeSummaries } from "@/lib/content";
import { DIFFICULTY_LABEL, formatFeet, formatMiles } from "@/lib/format";
import { directionsUrl } from "@/lib/geo";
import { HikeProvider } from "@/lib/hike-store";
import { SITE_NAME } from "@/lib/site";
import { photoUrl } from "@/lib/storage";

export async function generateStaticParams() {
  return (await getHikeSummaries()).map((h) => ({ slug: h.slug }));
}

// Guides are rendered once and cached. A save in the editor refreshes that guide's page straight
// away (revalidatePath in the save route). The hourly refresh is the safety net for changes made
// outside the editor (pnpm ingest, pnpm content seed). If a refresh fails (database unreachable,
// or a guide that no longer compiles), the last good page keeps being served.
export const revalidate = 3600;
// A hike created after the last deploy gets its page on first visit.
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/hikes/[slug]">): Promise<Metadata> {
  const page = await getHikePage((await params).slug);
  if (!page) return {};
  const { hike } = page;
  const url = `/hikes/${hike.slug}`;
  const description = `${hike.summary} ${formatMiles(hike.distanceMi)}, ${formatFeet(hike.elevationGainFt)} of climbing. ${hike.region}.`;
  // The cover photo is the card's image; a hike without one gets a text-only card.
  const images = hike.cover ? [{ url: photoUrl(hike.cover), alt: hike.title }] : undefined;
  return {
    title: hike.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: SITE_NAME, title: hike.title, description, url, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: hike.title, description, images },
  };
}

export default async function HikePage({ params }: PageProps<"/hikes/[slug]">) {
  const { slug } = await params;
  const page = await getHikePage(slug);
  if (!page) notFound();
  const { hike, waypoints, route, body } = page;

  const stats = [
    { k: "Distance", v: formatMiles(hike.distanceMi) },
    { k: "Elev. gain", v: formatFeet(hike.elevationGainFt) },
    hike.estTime && { k: "Est. time", v: hike.estTime },
    { k: "Difficulty", v: DIFFICULTY_LABEL[hike.difficulty] },
    hike.bestSeason && { k: "Best season", v: hike.bestSeason },
  ].filter((s): s is { k: string; v: string } => Boolean(s));

  return (
    <HikeProvider slug={slug} waypoints={waypoints} route={route} essentials={hike.essentials}>
      <GuideScrollSync />
      <article>
        {/* Hero: the cover photo, with the title as a card over it on wide screens and under it on a phone. */}
        <div className="relative">
          <div className="relative h-[200px] border-b-[1.5px] border-line-strong sm:h-[360px]">
            {/* Decorative here: the title is right beside it. */}
            <Photo photoKey={hike.cover} alt="" priority sizes="100vw" className="absolute inset-0" />
            <Link href="/" className="absolute left-3 top-2.5 rounded-full border border-line bg-card px-2.5 text-[15px] text-graphite sm:hidden">
              ← All hikes
            </Link>
          </div>
          <div className="px-4 pt-3.5 sm:absolute sm:bottom-6 sm:left-8 sm:max-w-[520px] sm:rounded-lg sm:border sm:border-line sm:bg-card sm:px-5 sm:py-3">
            <div className="text-sm text-bark">
              <Link href="/" className="hidden text-bark sm:inline">
                ← All hikes ·{" "}
              </Link>
              {hike.region}
            </div>
            <h1 className="font-display text-[30px] leading-[1.1] font-bold sm:text-[38px]">{hike.title}</h1>
            <p className="mt-1 sm:mt-0 sm:text-[17px]">{hike.summary}</p>
          </div>
        </div>

        {/* Mobile stat grid */}
        <div className="px-4 sm:hidden">
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {stats.map((s) => (
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
        <MinimapBar cards={hike.sidebar} />

        {/* Guide: sections column + sticky navigation rail */}
        <div className="mx-auto grid w-full max-w-[1200px] gap-11 px-4 pb-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 pt-2">
            {/* "Before you go" is part of the MDX now: placed by the author, or first by default. */}
            <MDXContent code={body} />
          </div>
          <GuideSidebar cards={hike.sidebar} />
        </div>
      </article>
    </HikeProvider>
  );
}
