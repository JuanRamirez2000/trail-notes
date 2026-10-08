import { REPO_URL, SITE_NAME } from "@/lib/site";

/** Closes every public page: what the guides are (and aren't), whose they are, where the code is. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep px-4 py-6 text-sm text-bark sm:px-7">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="max-w-[640px]">
          <strong className="text-graphite">Conditions change.</strong> These guides describe a trail on the day it was hiked. Check the weather, closures and your own limits before you go, and carry a
          map that works without signal.
        </p>
        <p className="flex-none sm:text-right">
          © {new Date().getFullYear()} {SITE_NAME}. Photos and text by the author.
          <br />
          <a href={REPO_URL} rel="noopener" className="underline">
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
