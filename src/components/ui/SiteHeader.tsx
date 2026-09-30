import Link from "next/link";
import { Wordmark } from "./Logo";

export function SiteHeader() {
  return (
    <header className="flex items-center gap-6 border-b border-line px-4 py-3 sm:px-7">
      <Link href="/" className="no-underline" aria-label="Trailnotes home">
        <Wordmark />
      </Link>
      <nav className="flex gap-5 text-lg">
        <Link href="/" className="border-b-[3px] border-ochre text-graphite hover:text-bark">
          Hikes
        </Link>
      </nav>
    </header>
  );
}
