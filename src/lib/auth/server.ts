import "server-only";
import { createServerClient } from "@supabase/ssr";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { editors } from "../../db/schema";
import { getDatabase } from "../store/server";
import type { Editor } from "../store/types";

/**
 * Who is using the editor. Everything that protects the editor goes through getEditor() here and
 * can() in ./can.ts, on the server; hiding a link in the UI is never the protection.
 *
 * EDITOR_AUTH picks the mode:
 *   supabase → Supabase Auth (Google sign-in). A signed-in person is an editor only if they're in
 *              the `editors` table; anyone else is treated exactly like a signed-out visitor.
 *   (unset)  → under `pnpm dev`: a fixed local owner, no sign-in. Anywhere else: nobody, so the
 *              editor is a 404.
 *   off      → nobody, even in dev (for testing the signed-out behaviour).
 */
export type AuthMode = "supabase" | "local" | "off";

export function authMode(): AuthMode {
  if (process.env.EDITOR_AUTH === "supabase") return "supabase";
  if (process.env.EDITOR_AUTH === "off") return "off";
  return process.env.NODE_ENV === "development" ? "local" : "off";
}

/**
 * Session cookies are only ever read on the server (there is no Supabase client in the browser),
 * so they're HttpOnly: a script injected into a page can't read an editor's session.
 */
export const hardened = <T extends object>(options: T) => ({ ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const });

const LOCAL_OWNER: Editor = { id: "local", name: "Local owner (pnpm dev)", role: "owner" };

/** A Supabase client bound to this request's session cookies. Uses the public key: it can only do what the signed-in user can. */
export async function sessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("EDITOR_AUTH=supabase needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, hardened(options));
        } catch {
          // Server Components can't set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in editor, or null. Cached per request. */
export const getEditor = cache(async (): Promise<Editor | null> => {
  const mode = authMode();
  if (mode === "off") return null;
  if (mode === "local") return LOCAL_OWNER;

  const supabase = await sessionClient();
  // getUser() checks the session with Supabase's auth server; it doesn't just trust the cookie.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  // The allow-list is read by the server's own database connection: the table is closed to browser roles.
  const [row] = await getDatabase().select({ role: editors.role }).from(editors).where(eq(editors.userId, user.id));
  if (!row) return null;

  const meta = user.user_metadata as { full_name?: string; name?: string };
  return { id: user.id, email: user.email, name: meta.full_name ?? meta.name ?? user.email ?? "Editor", role: row.role };
});
