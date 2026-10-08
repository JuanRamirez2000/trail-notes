import { can } from "@/lib/auth/can";
import { getEditor } from "@/lib/auth/server";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";

const notFound = () => new Response("Not found", { status: 404 });

/** The text and pins of one saved version, to preview or restore in the editor. Editors only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/editor/[slug]/history/[version]">) {
  const { slug, version } = await ctx.params;
  if (!SLUG.test(slug) || !/^\d{1,9}$/.test(version)) return notFound();
  const editor = await getEditor();
  if (!can(editor, "read", slug)) return notFound();
  const revision = await (await getStore()).revision(slug, version);
  if (!revision) return notFound();
  return Response.json(revision, { headers: { "cache-control": "no-store" } });
}
