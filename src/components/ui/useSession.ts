"use client";

import { useEffect, useState } from "react";
import { SESSION_HINT, type SessionInfo } from "@/lib/auth/session-hint";

/**
 * Who's signed in, as far as a public page needs to know (see /api/session). Null until known,
 * and it stays null for a visitor without asking the server: the request is only made when this
 * browser has the sign-in hint cookie, or under `pnpm dev`, where the editor is the local owner
 * and there's no sign-in to leave a hint.
 */
export function useSession(slug?: string): SessionInfo | null {
  const [session, setSession] = useState<SessionInfo | null>(null);
  useEffect(() => {
    const hinted = document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_HINT}=`));
    if (!hinted && process.env.NODE_ENV !== "development") return;
    let on = true;
    fetch(`/api/session${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`)
      .then((r) => (r.ok ? (r.json() as Promise<SessionInfo>) : null))
      .then((info) => on && setSession(info))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [slug]);
  return session;
}
