import { NextResponse } from "next/server";
import { can } from "@/lib/auth/can";
import { authMode, getEditor } from "@/lib/auth/server";
import { SESSION_HINT, type SessionInfo } from "@/lib/auth/session-hint";
import { SLUG } from "@/lib/schemas";

/**
 * Who is looking at a public page, for its header and its "Edit this guide" link: an editor's
 * name and role, or nobody. With `?slug=`, also whether they may edit that hike. It says nothing
 * a signed-out visitor couldn't see, and it's never the access check: the editor's own pages and
 * routes decide that again for themselves.
 *
 * Public pages only call it when the sign-in hint cookie is there (or under `pnpm dev`), so
 * ordinary visitors never reach it.
 */
export async function GET(request: Request) {
  const editor = await getEditor();
  const slug = new URL(request.url).searchParams.get("slug");
  const info: SessionInfo = {
    editor: can(editor, "list") ? { name: editor.name, role: editor.role } : null,
    canEdit: !!slug && SLUG.test(slug) && can(editor, "save", slug),
    canSignOut: authMode() === "supabase",
  };
  const res = NextResponse.json(info, { headers: { "cache-control": "private, no-store" } });
  // Signed out since the hint was set (expired, or signed out in another tab): stop asking.
  if (!info.editor) res.cookies.delete(SESSION_HINT);
  return res;
}
