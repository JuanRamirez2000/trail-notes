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
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser(); // refreshes the tokens if they're close to expiring
  return response;
}

export const config = {
  matcher: ["/editor/:path*", "/api/editor/:path*", "/sign-in", "/auth/:path*"],
};
