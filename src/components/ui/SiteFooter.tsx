import Link from "next/link";
import { getHikeSummaries } from "@/lib/content";
import { REPO_URL, SITE_NAME } from "@/lib/site";
import { Wordmark } from "./Logo";

const heading = "font-mono text-[11px] font-semibold tracking-[.08em] text-bark uppercase";
const link = "text-graphite underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest";

/**
 * Closes every public page: what the site is, where to go next, whose it is, and the reminder that
 * a guide describes one day on a trail.
 */
export async function SiteFooter() {
  // A footer must never take its page down: if the store can't be read, the links to guides are left out.
  const latest = (await getHikeSummaries().catch(() => [])).slice(0, 3);
  return (
    <footer className="border-t border-line bg-paper-deep text-[15px] text-graphite">
      <div className="mx-auto grid w-full max-w-[1200px] gap-x-10 gap-y-8 px-4 py-10 sm:grid-cols-2 sm:px-7 lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-block no-underline" aria-label="Trailnotes home">
            <Wordmark size={28} />
          </Link>
          <p className="mt-3 max-w-[420px] text-bark">Photo-by-photo hiking guides. Every turn is photographed and pinned on the map where it was taken, with distances and climbs from a GPS recording.</p>
        </div>

        <nav aria-label="Footer">
          <h2 className={heading}>Explore</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/hikes" className={link}>
                All hikes
              </Link>
            </li>
            {latest.map((h) => (
              <li key={h.slug}>
                <Link href={`/hikes/${h.slug}`} className={link}>
                  {h.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={heading}>The project</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <a href={REPO_URL} rel="noopener" className={link}>
                Source on GitHub
              </a>
            </li>
            <li>
              <a href={`${REPO_URL}/blob/main/LICENSE`} rel="noopener" className={link}>
                Licence
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-5 text-sm text-bark sm:px-7 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <p className="max-w-[720px]">
            <strong className="text-graphite">Conditions change.</strong> These guides describe a trail on the day it was hiked. Check the weather, closures and your own limits before you go, and carry a
            map that works without signal.
          </p>
          <p className="flex-none">
            © {new Date().getFullYear()} {SITE_NAME}. Photos and text by the author.
          </p>
        </div>
      </div>
    </footer>
  );
}
