import { NextResponse } from "next/server";
import { authMode, sessionClient } from "@/lib/auth/server";
import { sameOrigin } from "@/lib/auth/request";

export async function POST(request: Request) {
  if (authMode() !== "supabase") return new Response("Not found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  await (await sessionClient()).auth.signOut();
  return NextResponse.redirect(`${new URL(request.url).origin}/sign-in`, { status: 303 });
}
