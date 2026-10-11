import { NextResponse } from "next/server";
import { authMode, sessionClient } from "@/lib/auth/server";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_HINT } from "@/lib/auth/session-hint";

export async function POST(request: Request) {
  if (authMode() !== "supabase") return new Response("Not found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  await (await sessionClient()).auth.signOut();
  // Signed out, you're a visitor: back to the front page.
  const res = NextResponse.redirect(`${new URL(request.url).origin}/`, { status: 303 });
  res.cookies.delete(SESSION_HINT);
  return res;
}
