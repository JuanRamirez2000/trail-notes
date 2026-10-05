import { NextResponse } from "next/server";
import { can } from "@/lib/auth/can";
import { authMode, getEditor, sessionClient } from "@/lib/auth/server";

/**
 * Where Google sends the browser back. Swaps the one-time code for a session, then checks the
 * person is on the editors list. Someone who signed in but isn't an editor is signed straight
 * back out: having a Google account must not get anyone a session here.
 */
export async function GET(request: Request) {
  if (authMode() !== "supabase") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(`${url.origin}${path}`, { status: 303 });
  if (!code) return to("/sign-in?error=cancelled");

  const supabase = await sessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return to("/sign-in?error=failed");

  if (!can(await getEditor(), "list")) {
    await supabase.auth.signOut();
    return to("/sign-in?error=not-an-editor");
  }
  return to("/editor");
}
