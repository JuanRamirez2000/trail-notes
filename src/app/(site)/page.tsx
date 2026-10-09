import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { HikeCard } from "@/components/gallery/HikeCard";
import { EssentialsCard } from "@/components/hike/BeforeYouGo";
import { PhotoLightbox } from "@/components/hike/PhotoLightbox";
import { ActivePhotoCard } from "@/components/landing/ActivePhotoCard";
import { ElevationProfile } from "@/components/mdx/ElevationProfile";
import { Minimap } from "@/components/mdx/Minimap";
import { RouteMap } from "@/components/mdx/RouteMap";
import { StepList } from "@/components/sidebar/StepList";
import { Photo } from "@/components/ui/Photo";
import { getHikePage, getHikeSummaries } from "@/lib/content";
import { formatFeet, formatMiles } from "@/lib/format";
import { HikeProvider } from "@/lib/hike-store";

// Lists the latest guides, so it's cached like the gallery: refreshed on publish, hourly as a safety net.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * One thing a guide does: a title, a sentence or two, and the guide's own block showing it. The
 * blocks carry their own vertical margins for a guide's text column; here the row sets the spacing.
 */
function Feature({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <li className="grid items-center gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div>
        <h3 className="font-display text-2xl leading-tight font-bold">{title}</h3>
        <p className="mt-1.5 text-body text-bark">{text}</p>
      </div>
      {children && <div className="min-w-0 [&_section]:my-0">{children}</div>}
    </li>
  );
}

/**
 * The front door. A short hero, then what a guide does, shown with the latest guide's own blocks:
 * a guide page without the guide's text. The blocks share one selection, as they do in a guide.
 */
export default async function HomePage() {
  const hikes = await getHikeSummaries();
  const [latest, ...rest] = hikes;
  const page = latest ? await getHikePage(latest.slug) : null;
  const essentials = page?.hike.essentials;

  // With no guide to show (none published yet), the features are still listed, as text.
  const features = (
    <ul className="mt-8 flex flex-col gap-12 lg:gap-16">
      <Feature title="A photo where the trail changes" text="Junctions, the start of the steep part, the spot where the path is easy to lose. Each has a photo, looking the way you'll be walking.">
        {page && <ActivePhotoCard />}
      </Feature>
      <Feature title="Every photo on the map" text="Each pin is where a photo was taken. Pick one and the photo above, the profile and the small map below all move to it.">
        {page && <RouteMap height={340} />}
      </Feature>
      <Feature title="The climb, mile by mile" text="The route and its elevation come from a GPS recording of the hike, so you can see where the hard part starts and how long it lasts.">
        {page?.profile && <ElevationProfile />}
      </Feature>
      <Feature title="A map that follows you" text="A small map stays beside the guide and points the way the current photo faces. Step through the hike or jump to any part of it.">
        {page && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Minimap height={260} />
            <StepList className="max-h-[304px]" />
          </div>
        )}
      </Feature>
      <Feature title="What to know before you go" text="Parking, water, permits and hazards come first, before the first step.">
        {essentials && <EssentialsCard essentials={essentials} />}
      </Feature>
    </ul>
  );

  return (
    <>
      <section className="relative border-b border-line">
        <div className="relative h-[220px] border-b-[1.5px] border-line-strong sm:h-[460px] sm:border-b-0">
          <Photo photoKey={latest?.cover} alt={latest?.cover ? `On the ${latest.title} hike, ${latest.region}` : ""} priority sizes="100vw" className="absolute inset-0" />
          {latest && (
            <Link
              href={`/hikes/${latest.slug}`}
              className="absolute top-3 right-3 rounded-full border border-line bg-card px-3 text-[15px] leading-8 text-graphite no-underline hover:text-forest sm:top-auto sm:right-8 sm:bottom-6"
            >
              {latest.title} · {formatMiles(latest.distanceMi)} · ↑ {formatFeet(latest.elevationGainFt)} →
            </Link>
          )}
        </div>
        <div className="px-4 py-6 sm:absolute sm:bottom-6 sm:left-8 sm:max-w-[500px] sm:rounded-[10px] sm:border sm:border-line sm:bg-card sm:px-7 sm:py-6 sm:shadow-sketch">
          <h1 className="font-display text-[32px] leading-[1.08] font-bold text-forest sm:text-[40px]">Know every turn before you get there.</h1>
          <p className="mt-3 text-body">Hiking guides with a photo at every turn, pinned on the map where it was taken.</p>
          <Link href="/hikes" className="mt-5 inline-block rounded-lg bg-forest px-5 py-2.5 text-lg text-paper no-underline hover:text-paper">
            Browse the hikes
          </Link>
        </div>
      </section>

      <section aria-labelledby="in-a-guide" className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-7 sm:py-14">
        <h2 id="in-a-guide" className="font-display text-h2 font-bold text-forest">
          What&rsquo;s in a guide
        </h2>
        {page && (
          <p className="mt-1 text-bark">
            These are live, from{" "}
            <Link href={`/hikes/${page.hike.slug}`} className="underline underline-offset-4">
              {page.hike.title}
            </Link>
            . Try them.
          </p>
        )}
        {page ? (
          <HikeProvider slug={page.hike.slug} waypoints={page.waypoints} route={page.route} profile={page.profile} essentials={essentials}>
            <PhotoLightbox />
            {features}
          </HikeProvider>
        ) : (
          features
        )}
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
