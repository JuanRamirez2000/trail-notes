import { editorEnabled, validateHikeFiles, writeHikeFiles } from "@/lib/editor-fs";

export async function PUT(req: Request, ctx: RouteContext<"/api/editor/[slug]">) {
  if (!editorEnabled) return new Response("Not found", { status: 404 });

  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return new Response("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as { mdx?: unknown; waypoints?: unknown } | null;
  if (typeof body?.mdx !== "string" || typeof body?.waypoints !== "string") {
    return Response.json({ ok: false, problems: ["Expected { mdx: string, waypoints: string }"] }, { status: 400 });
  }

  const problems = await validateHikeFiles(slug, body.mdx, body.waypoints);
  if (problems.length) return Response.json({ ok: false, problems }, { status: 422 });

  await writeHikeFiles(slug, body.mdx, body.waypoints);
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
