import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the editor's Supabase session fresh. Sessions are short-lived tokens in cookies; Server
 * Components can read cookies but not write them, so the refresh has to happen here, before the
 * page runs. Only the editor, its API and the sign-in routes are matched: public pages never
 * touch auth and stay cacheable.
 *
 * This is not the access check. Pages and routes call getEditor()/can() themselves.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.EDITOR_AUTH !== "supabase" || !url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        // HttpOnly: these cookies are only read on the server (same rule as lib/auth/server.ts,
        // repeated here because the proxy can't share modules with the app).
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser(); // refreshes the tokens if they're close to expiring
  // The readable "signed in once" hint the public header goes by (lib/auth/session-hint.ts, whose
  // name and options are repeated here for the same reason as above). The sign-in callback sets
  // it; this covers a session that began before the hint existed, or whose hint expired first.
  if (data.user && !request.cookies.has("tn_signed_in")) {
    response.cookies.set("tn_signed_in", "1", { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 60 });
  }
  return response;
}

export const config = {
  // /api/session is what public pages ask "who's signed in"; it needs a fresh session to answer.
  matcher: ["/editor/:path*", "/api/editor/:path*", "/api/session", "/sign-in", "/auth/:path*"],
};
