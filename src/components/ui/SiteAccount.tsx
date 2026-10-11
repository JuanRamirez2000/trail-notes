"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./useSession";

/**
 * The right-hand end of the public header. For a visitor: a quiet "Sign in" link, when this site
 * has sign-in at all. For a signed-in editor: the way into the editor, their name, and sign out.
 */
export function SiteAccount({ signIn }: { signIn: boolean }) {
  const session = useSession();
  const pathname = usePathname();

  if (session?.editor) {
    return (
      <div className="ml-auto flex items-center gap-3 text-[15px]">
        <Link href="/editor" className="rounded-lg border border-forest bg-highlight px-3 py-0.5 text-graphite no-underline">
          Editor
        </Link>
        <span className="hidden max-w-[16ch] truncate text-bark sm:inline" title={session.editor.name}>
          {session.editor.name}
        </span>
        {session.canSignOut && (
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="cursor-pointer text-bark underline underline-offset-2">
              Sign out
            </button>
          </form>
        )}
      </div>
    );
  }
  if (!signIn) return null;
  return (
    <Link href={pathname === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname)}`} className="ml-auto text-[15px] text-bark">
      Sign in
    </Link>
  );
}
