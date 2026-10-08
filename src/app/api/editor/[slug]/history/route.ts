import { can } from "@/lib/auth/can";
import { getEditor } from "@/lib/auth/server";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";

const notFound = () => new Response("Not found", { status: 404 });

/** A guide's saved versions, newest first. Editors only; everyone else gets the editor's usual 404. */
export async function GET(_req: Request, ctx: RouteContext<"/api/editor/[slug]/history">) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) return notFound();
  const editor = await getEditor();
  if (!can(editor, "read", slug)) return notFound();
  const store = await getStore();
  return Response.json({ revisions: await store.history(slug), kept: store.kind !== "local" }, { headers: { "cache-control": "no-store" } });
}
