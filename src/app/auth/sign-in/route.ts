import { NextResponse } from "next/server";
import { authMode, sessionClient } from "@/lib/auth/server";

/** Starts Google sign-in: sends the browser to Google, which comes back to /auth/callback. */
export async function GET(request: Request) {
  if (authMode() !== "supabase") return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/sign-in?error=start`, { status: 303 });
  return NextResponse.redirect(data.url, { status: 303 });
}
