import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";

const allow = rateLimiter({ limit: 30, windowMs: 60_000 });
const notFound = () => new Response("Not found", { status: 404 });
const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Takes a hike off the deletion schedule (see DELETE on ../route.ts). It comes back as a draft:
 * nothing public changes, and publishing it again is the editor's next step if they want it.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/editor/[slug]/restore">) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) return notFound();

  const editor = await getEditor();
  if (!can(editor, "delete", slug)) return notFound();
  if (!sameOrigin(req)) return json({ ok: false, problems: ["Request must come from the editor."] }, 403);
  if (!allow(editor.id)) return json({ ok: false, problems: ["Too many requests. Wait a moment and try again."] }, 429);

  const result = await (await getStore()).cancelDelete(slug);
  return result.ok ? json({ ok: true }, 200) : notFound();
}

// Other methods get the same 404 as everything else about the editor (Next would say 405).
export { notFound as GET, notFound as PUT, notFound as PATCH, notFound as DELETE };
