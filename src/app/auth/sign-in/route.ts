import { NextResponse } from "next/server";
import { authMode, hardened, sessionClient } from "@/lib/auth/server";
import { NEXT_COOKIE, safeNext } from "@/lib/auth/session-hint";

/** Starts Google sign-in: sends the browser to Google, which comes back to /auth/callback. */
export async function GET(request: Request) {
  if (authMode() !== "supabase") return new Response("Not found", { status: 404 });
  const { origin, searchParams } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/sign-in?error=start`, { status: 303 });
  const res = NextResponse.redirect(data.url, { status: 303 });
  // Kept in a cookie, not in the address Google returns to: Supabase only accepts the exact callback address.
  if (next) res.cookies.set(NEXT_COOKIE, next, hardened({ path: "/", maxAge: 600 }));
  else res.cookies.delete(NEXT_COOKIE);
  return res;
}
