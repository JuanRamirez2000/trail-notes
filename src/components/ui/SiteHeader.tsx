import Link from "next/link";
import { Wordmark } from "./Logo";
import { authMode } from "@/lib/auth/server";
import { SiteAccount } from "./SiteAccount";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="flex items-center gap-6 border-b border-line px-4 py-3 sm:px-7">
      <Link href="/" className="no-underline" aria-label="Trailnotes home">
        <Wordmark />
      </Link>
      <SiteNav />
      {/* Whether this site has sign-in is fixed at build time; who is signed in is asked by the browser. */}
      <SiteAccount signIn={authMode() === "supabase"} />
    </header>
  );
}
