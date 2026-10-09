"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page fails to render (the database can't be reached, say). A cached guide keeps
 * being served when its refresh fails, so this is mostly for pages that were never rendered.
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="bg-contour flex flex-1 items-center justify-center px-4 py-16">
      <div role="alert" className="max-w-md rounded-[10px] border border-line bg-card px-6 py-7 text-center shadow-sketch">
        <p className="font-mono text-xs font-semibold tracking-[.1em] text-bark uppercase">Something went wrong</p>
        <h1 className="mt-1 font-display text-[32px] leading-[38px] font-bold text-forest">The trail is washed out here</h1>
        <p className="mt-2 text-body text-graphite">This page couldn&apos;t be loaded just now. It&apos;s usually temporary: try again in a moment.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="cursor-pointer rounded-lg bg-forest px-5 py-2.5 text-lg text-paper">
            Try again
          </button>
          <Link href="/hikes" className="rounded-lg border border-line-strong px-5 py-2.5 text-lg text-graphite">
            All hikes
          </Link>
        </div>
        {error.digest && <p className="mt-4 font-mono text-xs text-bark">Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
